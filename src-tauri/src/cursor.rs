//! Windows "hide pointer while typing" hides the mouse cursor through the
//! display counter of the main thread. Native dialogs run on that same thread,
//! so after typing they would open with an invisible cursor. The frontend calls
//! `cursor_unhide` before a dialog and `cursor_restore` after it.

#[cfg(windows)]
mod imp {
    use windows_sys::Win32::UI::WindowsAndMessaging::ShowCursor;

    /// Makes the cursor visible. Returns how many times the counter was raised.
    pub fn unhide() -> u32 {
        let mut raised = 0;
        // SAFETY: ShowCursor only updates the calling thread's display counter.
        while unsafe { ShowCursor(1) } < 0 {
            raised += 1;
        }
        // The last call also raised the counter.
        raised + 1
    }

    /// Undoes `unhide`, so the cursor is hidden again until the mouse moves.
    pub fn restore(raised: u32) {
        for _ in 0..raised {
            // SAFETY: see `unhide`.
            unsafe { ShowCursor(0) };
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn unhide() -> u32 {
        0
    }

    pub fn restore(_raised: u32) {}
}

pub use imp::{restore, unhide};
