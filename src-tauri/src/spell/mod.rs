//! Spell checking with the system's checker (on Windows, the one Word and
//! Edge use, with the dictionaries installed in Windows).
//!
//! The checker is a COM object that must stay on the thread that created it,
//! so it lives on a thread of its own and requests come through a channel.

use serde::Serialize;
use std::sync::Mutex;
use std::sync::mpsc::{self, Sender};

/// A misspelled word in a line, in UTF-16 code units (JavaScript string indices).
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub struct Misspelling {
    pub start: u32,
    pub length: u32,
}

enum Request {
    Check(
        String,
        Vec<String>,
        Sender<Result<Vec<Vec<Misspelling>>, String>>,
    ),
    Suggest(String, String, Sender<Result<Vec<String>, String>>),
    Add(String, String, Sender<Result<(), String>>),
    Languages(Sender<Result<Vec<String>, String>>),
}

/// Handle to the spell checking thread, started on first use.
#[derive(Default)]
pub struct Speller(Mutex<Option<Sender<Request>>>);

impl Speller {
    fn send<T>(
        &self,
        make: impl FnOnce(Sender<Result<T, String>>) -> Request,
    ) -> Result<T, String> {
        let (reply, answer) = mpsc::channel();
        {
            let mut sender = self.0.lock().unwrap();
            let tx = sender.get_or_insert_with(start);
            if let Err(mpsc::SendError(request)) = tx.send(make(reply)) {
                // The thread is gone (it panicked): start a new one once.
                *tx = start();
                tx.send(request).map_err(|e| e.to_string())?;
            }
        }
        answer.recv().map_err(|e| e.to_string())?
    }

    /// Misspellings of each line, for a language tag ("fr", "fr-FR", "en").
    pub fn check(
        &self,
        language: String,
        lines: Vec<String>,
    ) -> Result<Vec<Vec<Misspelling>>, String> {
        self.send(|reply| Request::Check(language, lines, reply))
    }

    pub fn suggest(&self, language: String, word: String) -> Result<Vec<String>, String> {
        self.send(|reply| Request::Suggest(language, word, reply))
    }

    /// Language tags with a dictionary installed ("fr-FR", "en-US").
    pub fn languages(&self) -> Result<Vec<String>, String> {
        self.send(Request::Languages)
    }

    /// Adds a word to the user's dictionary (kept by the system).
    pub fn add(&self, language: String, word: String) -> Result<(), String> {
        self.send(|reply| Request::Add(language, word, reply))
    }
}

fn start() -> Sender<Request> {
    let (tx, rx) = mpsc::channel::<Request>();
    std::thread::spawn(move || {
        let mut backend = system::Backend::new();
        for request in rx {
            match request {
                Request::Check(language, lines, reply) => {
                    let _ = reply.send(backend.check(&language, &lines));
                }
                Request::Suggest(language, word, reply) => {
                    let _ = reply.send(backend.suggest(&language, &word));
                }
                Request::Add(language, word, reply) => {
                    let _ = reply.send(backend.add(&language, &word));
                }
                Request::Languages(reply) => {
                    let _ = reply.send(backend.languages());
                }
            }
        }
    });
    tx
}

#[cfg(windows)]
mod system {
    use super::Misspelling;
    use std::collections::HashMap;
    use windows::Win32::Foundation::S_OK;
    use windows::Win32::Globalization::{
        ISpellChecker, ISpellCheckerFactory, ISpellingError, SpellCheckerFactory,
    };
    use windows::Win32::System::Com::{
        CLSCTX_ALL, COINIT_MULTITHREADED, CoCreateInstance, CoInitializeEx, CoTaskMemFree,
        IEnumString,
    };
    use windows::core::{HSTRING, PWSTR};

    pub struct Backend {
        factory: Result<ISpellCheckerFactory, String>,
        checkers: HashMap<String, ISpellChecker>,
    }

    fn text(error: windows::core::Error) -> String {
        error.message().to_string()
    }

    /// Takes a string the system allocated for us, and frees it.
    unsafe fn take(value: PWSTR) -> String {
        let text = unsafe { value.to_string() }.unwrap_or_default();
        unsafe { CoTaskMemFree(Some(value.0 as *const _)) };
        text
    }

    unsafe fn strings(list: &IEnumString) -> Vec<String> {
        let mut out = Vec::new();
        loop {
            let mut item = [PWSTR::null()];
            if unsafe { list.Next(&mut item, None) } != S_OK {
                break;
            }
            out.push(unsafe { take(item[0]) });
        }
        out
    }

    impl Backend {
        pub fn new() -> Self {
            let factory = unsafe {
                let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
                CoCreateInstance::<_, ISpellCheckerFactory>(&SpellCheckerFactory, None, CLSCTX_ALL)
            }
            .map_err(text);
            Self {
                factory,
                checkers: HashMap::new(),
            }
        }

        /// The checker for a language: "fr" takes the first French installed ("fr-FR").
        fn checker(&mut self, language: &str) -> Result<&ISpellChecker, String> {
            if !self.checkers.contains_key(language) {
                let factory = self.factory.as_ref().map_err(Clone::clone)?;
                let tag = unsafe {
                    if factory
                        .IsSupported(&HSTRING::from(language))
                        .map_err(text)?
                        .as_bool()
                    {
                        language.to_owned()
                    } else {
                        let wanted = language.to_lowercase();
                        strings(&factory.SupportedLanguages().map_err(text)?)
                            .into_iter()
                            .find(|tag| tag.to_lowercase().starts_with(&wanted))
                            .ok_or_else(|| {
                                format!(
                                    "aucun dictionnaire « {language} » n'est installé dans Windows"
                                )
                            })?
                    }
                };
                let checker =
                    unsafe { factory.CreateSpellChecker(&HSTRING::from(tag)) }.map_err(text)?;
                self.checkers.insert(language.to_owned(), checker);
            }
            Ok(&self.checkers[language])
        }

        pub fn check(
            &mut self,
            language: &str,
            lines: &[String],
        ) -> Result<Vec<Vec<Misspelling>>, String> {
            let checker = self.checker(language)?;
            let mut out = Vec::with_capacity(lines.len());
            for line in lines {
                let mut found = Vec::new();
                let errors =
                    unsafe { checker.Check(&HSTRING::from(line.as_str())) }.map_err(text)?;
                loop {
                    let mut error: Option<ISpellingError> = None;
                    if unsafe { errors.Next(&mut error) } != S_OK {
                        break;
                    }
                    let Some(error) = error else { break };
                    let (start, length) = unsafe { (error.StartIndex(), error.Length()) };
                    found.push(Misspelling {
                        start: start.map_err(text)?,
                        length: length.map_err(text)?,
                    });
                }
                out.push(found);
            }
            Ok(out)
        }

        pub fn suggest(&mut self, language: &str, word: &str) -> Result<Vec<String>, String> {
            let checker = self.checker(language)?;
            let list = unsafe { checker.Suggest(&HSTRING::from(word)) }.map_err(text)?;
            Ok(unsafe { strings(&list) })
        }

        pub fn add(&mut self, language: &str, word: &str) -> Result<(), String> {
            let checker = self.checker(language)?;
            unsafe { checker.Add(&HSTRING::from(word)) }.map_err(text)
        }

        pub fn languages(&mut self) -> Result<Vec<String>, String> {
            let factory = self.factory.as_ref().map_err(Clone::clone)?;
            Ok(unsafe { strings(&factory.SupportedLanguages().map_err(text)?) })
        }
    }
}

#[cfg(not(windows))]
mod system {
    use super::Misspelling;

    const UNAVAILABLE: &str =
        "la correction orthographique n'est pas encore disponible sur ce système";

    pub struct Backend;

    impl Backend {
        pub fn new() -> Self {
            Self
        }
        pub fn check(&mut self, _: &str, _: &[String]) -> Result<Vec<Vec<Misspelling>>, String> {
            Err(UNAVAILABLE.into())
        }
        pub fn suggest(&mut self, _: &str, _: &str) -> Result<Vec<String>, String> {
            Err(UNAVAILABLE.into())
        }
        pub fn add(&mut self, _: &str, _: &str) -> Result<(), String> {
            Err(UNAVAILABLE.into())
        }
        pub fn languages(&mut self) -> Result<Vec<String>, String> {
            Err(UNAVAILABLE.into())
        }
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn checks_and_suggests_with_the_windows_dictionaries() {
        let speller = Speller::default();
        let found = match speller.check("fr".into(), vec!["Bonjour chocola, à bientôt".into()]) {
            Ok(found) => found,
            // No French dictionary on this machine (a CI runner): nothing to test.
            Err(e) if e.contains("aucun dictionnaire") => {
                eprintln!("skipped: {e}");
                return;
            }
            Err(e) => panic!("{e}"),
        };
        assert_eq!(
            found,
            vec![vec![Misspelling {
                start: 8,
                length: 7
            }]]
        );
        let suggestions = speller.suggest("fr".into(), "chocola".into()).unwrap();
        assert!(
            suggestions.iter().any(|s| s == "chocolat"),
            "{suggestions:?}"
        );
    }
}
