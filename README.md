# Header Switch: Request Headers

Minimal Chrome Manifest V3 extension for adding and removing request headers.

## Install In Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this folder.
5. Click the extension icon to open the popup.

## Use

- Use the top switch to enable or disable all rules.
- Use the checkbox in each row to enable or disable one header.
- Choose `Set` to add or replace a request header.
- Choose `Remove` to remove a request header.
- Use `+` to add a row.
- Use `x` to delete a row from the popup.
- Changes are saved and applied automatically.

The URL filter is optional. If empty, the rule matches all URLs. To limit the rule, use a Chrome declarativeNetRequest URL filter such as:

```json
||api.example.com/
```

The extension currently requests `<all_urls>` host permission so the popup can target any URL. If you only need one domain, you can narrow `host_permissions` in `manifest.json`, then reload the extension.

The toolbar icon changes when rules are active. It is inactive when the global switch is off or no enabled header has a name.

## Verify

Open DevTools, make the request, then check the request headers in the Network tab.
