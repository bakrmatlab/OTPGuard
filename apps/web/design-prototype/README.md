# OTPGuard dark design prototype

One original, dark-only direction for the homepage, management and extension popup.
Throwaway design-review code. It is not imported by either application and is not a
production route. No providers, extension APIs, external resources or persistence.

From the repository root:

```sh
python3 -m http.server 4318 --bind 127.0.0.1 --directory apps/web/design-prototype
```

Open http://127.0.0.1:4318. The bottom review bar opens the homepage, management and
popup states. Setup, help and example activity are available through the navigation.
Direct screens use `#home`, `#manage`, `#popups`, `#setup`, `#activity`, `#help`.

The Fill demo inserts only the synthetic value `047291` into its own read-only demo
field. It has no form or submission control. Reset restores the initial state.
Management buttons change examples in memory. Reload resets all state. The popup
refusal selector covers ambiguity, navigation, reconnect, blocking, unsupported
fields, expiry and replay without offering a Fill bypass.

System: Big Shoulders display type; Instrument Sans body type; charcoal surfaces,
lime actions, restrained mint focus and amber failure accents. Fonts are bundled
with their SIL Open Font License notices. No Marathon branding or assets are used.

The owner requested one direction and no computer use. Accordingly there are no
alternate variants, browser automation or screenshots. Responsive layouts are
implemented, but visual/browser acceptance remains for owner review.

See [scope and acceptance](../../../documentation/dark-design-prototype.md).
