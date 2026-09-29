//! Text file decoding and encoding: BOM, charset detection, binary detection
//! and line endings. The frontend always works with UTF-8 text and "\n".

use encoding_rs::{Encoding, UTF_8, UTF_16BE, UTF_16LE};
use serde::{Deserialize, Serialize};

/// How many leading bytes are scanned for NUL to flag a binary file.
const BINARY_SCAN_LEN: usize = 8000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LineEnding {
    Lf,
    Crlf,
}

/// What is needed to write a file back the way it was read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextInfo {
    /// WHATWG label in lower case: "utf-8", "utf-16le", "windows-1252"...
    pub encoding: String,
    pub bom: bool,
    pub line_ending: LineEnding,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Decoded {
    /// Content with "\n" line endings. Empty for binary files.
    pub text: String,
    pub binary: bool,
    #[serde(flatten)]
    pub info: TextInfo,
}

fn encoding_name(encoding: &'static Encoding) -> String {
    encoding.name().to_ascii_lowercase()
}

fn detect_line_ending(text: &str) -> LineEnding {
    let crlf = text.matches("\r\n").count();
    let lf = text.matches('\n').count() - crlf;
    if crlf > lf {
        LineEnding::Crlf
    } else {
        LineEnding::Lf
    }
}

pub fn decode(bytes: &[u8]) -> Decoded {
    let (encoding, bom) = match Encoding::for_bom(bytes) {
        Some((encoding, _)) => (encoding, true),
        None => {
            let head = &bytes[..bytes.len().min(BINARY_SCAN_LEN)];
            if head.contains(&0) {
                return Decoded {
                    text: String::new(),
                    binary: true,
                    info: TextInfo {
                        encoding: String::new(),
                        bom: false,
                        line_ending: LineEnding::Lf,
                    },
                };
            }
            let encoding = if std::str::from_utf8(bytes).is_ok() {
                UTF_8
            } else {
                let mut detector = chardetng::EncodingDetector::new();
                detector.feed(bytes, true);
                detector.guess(None, true)
            };
            (encoding, false)
        }
    };

    // decode() strips a BOM matching the encoding it returns.
    let (text, actual, _) = encoding.decode(bytes);
    let line_ending = detect_line_ending(&text);
    Decoded {
        text: text.replace("\r\n", "\n"),
        binary: false,
        info: TextInfo {
            encoding: encoding_name(actual),
            bom,
            line_ending,
        },
    }
}

/// Decodes with a chosen encoding instead of the detected one ("Rouvrir avec
/// un autre encodage"). A BOM of that encoding is kept track of and removed.
pub fn decode_as(bytes: &[u8], label: &str) -> Result<Decoded, String> {
    let encoding = Encoding::for_label(label.as_bytes())
        .ok_or_else(|| format!("encodage inconnu : {label}"))?;
    let bom = Encoding::for_bom(bytes).is_some_and(|(found, _)| found == encoding);
    let (text, _) = encoding.decode_with_bom_removal(bytes);
    let line_ending = detect_line_ending(&text);
    Ok(Decoded {
        text: text.replace("\r\n", "\n"),
        binary: false,
        info: TextInfo {
            encoding: encoding_name(encoding),
            bom,
            line_ending,
        },
    })
}

pub fn encode(text: &str, info: &TextInfo) -> Result<Vec<u8>, String> {
    let text = match info.line_ending {
        LineEnding::Lf => text.to_owned(),
        LineEnding::Crlf => text.replace('\n', "\r\n"),
    };
    let encoding = Encoding::for_label(info.encoding.as_bytes())
        .ok_or_else(|| format!("encodage inconnu : {}", info.encoding))?;

    let mut out = Vec::with_capacity(text.len() + 3);
    if encoding == UTF_16LE || encoding == UTF_16BE {
        // encoding_rs cannot encode UTF-16, do it by hand.
        let to_bytes = if encoding == UTF_16LE {
            u16::to_le_bytes
        } else {
            u16::to_be_bytes
        };
        if info.bom {
            out.extend_from_slice(&to_bytes(0xFEFF));
        }
        for unit in text.encode_utf16() {
            out.extend_from_slice(&to_bytes(unit));
        }
        return Ok(out);
    }

    if encoding == UTF_8 && info.bom {
        out.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
    }
    let (bytes, _, unmappable) = encoding.encode(&text);
    if unmappable {
        return Err(format!(
            "certains caractères n'existent pas en {} : enregistre plutôt le fichier en UTF-8",
            encoding.name()
        ));
    }
    out.extend_from_slice(&bytes);
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn roundtrip(bytes: &[u8]) -> Decoded {
        let decoded = decode(bytes);
        assert!(!decoded.binary);
        let encoded = encode(&decoded.text, &decoded.info).expect("encode");
        assert_eq!(encoded, bytes, "round trip must be byte-identical");
        decoded
    }

    #[test]
    fn utf8_lf() {
        let d = roundtrip("Elden Ring\n\tCombat exigeant\n".as_bytes());
        assert_eq!(d.info.encoding, "utf-8");
        assert!(!d.info.bom);
        assert_eq!(d.info.line_ending, LineEnding::Lf);
        assert_eq!(d.text, "Elden Ring\n\tCombat exigeant\n");
    }

    #[test]
    fn utf8_bom_crlf() {
        let d = roundtrip(b"\xEF\xBB\xBFligne un\r\nligne deux\r\n");
        assert_eq!(d.info.encoding, "utf-8");
        assert!(d.info.bom);
        assert_eq!(d.info.line_ending, LineEnding::Crlf);
        assert_eq!(d.text, "ligne un\nligne deux\n");
    }

    #[test]
    fn utf16le_bom() {
        let mut bytes = vec![0xFF, 0xFE];
        for unit in "héllo\r\n".encode_utf16() {
            bytes.extend_from_slice(&unit.to_le_bytes());
        }
        let d = roundtrip(&bytes);
        assert_eq!(d.info.encoding, "utf-16le");
        assert_eq!(d.text, "héllo\n");
    }

    #[test]
    fn utf16be_bom() {
        let mut bytes = vec![0xFE, 0xFF];
        for unit in "abc".encode_utf16() {
            bytes.extend_from_slice(&unit.to_be_bytes());
        }
        assert_eq!(roundtrip(&bytes).info.encoding, "utf-16be");
    }

    #[test]
    fn latin1_is_detected() {
        // "Café très réussi, déjà vu." in windows-1252.
        let bytes = b"Caf\xE9 tr\xE8s r\xE9ussi, d\xE9j\xE0 vu.\n";
        let d = roundtrip(bytes);
        assert_eq!(d.info.encoding, "windows-1252");
        assert_eq!(d.text, "Café très réussi, déjà vu.\n");
    }

    #[test]
    fn binary_is_flagged() {
        let d = decode(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR");
        assert!(d.binary);
        assert!(d.text.is_empty());
    }

    #[test]
    fn empty_file() {
        let d = roundtrip(b"");
        assert_eq!(d.info.encoding, "utf-8");
        assert_eq!(d.info.line_ending, LineEnding::Lf);
    }

    #[test]
    fn unmappable_characters_are_refused() {
        let info = TextInfo {
            encoding: "windows-1252".into(),
            bom: false,
            line_ending: LineEnding::Lf,
        };
        assert!(encode("emoji 😀", &info).is_err());
    }

    #[test]
    fn line_ending_conversion() {
        let info = TextInfo {
            encoding: "utf-8".into(),
            bom: false,
            line_ending: LineEnding::Crlf,
        };
        assert_eq!(encode("a\nb", &info).unwrap(), b"a\r\nb");
    }

    #[test]
    fn decodes_with_a_chosen_encoding() {
        // "été" in Windows-1252, read as if it were Latin-1 by mistake or not.
        let bytes = b"\xe9t\xe9\r\n";
        let decoded = decode_as(bytes, "windows-1252").unwrap();
        assert_eq!(decoded.text, "été\n");
        assert_eq!(decoded.info.line_ending, LineEnding::Crlf);
        assert!(!decoded.info.bom);

        // A BOM of the chosen encoding is removed and remembered.
        let decoded = decode_as(b"\xef\xbb\xbfabc", "utf-8").unwrap();
        assert_eq!((decoded.text.as_str(), decoded.info.bom), ("abc", true));
        assert!(decode_as(b"x", "klingon").is_err());
    }
}
