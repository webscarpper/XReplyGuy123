# Disable Auto CAPTCHA Solving - Let User Handle Manually

## TASK
Disable Browserbase's automatic CAPTCHA solving feature so the user can handle CAPTCHAs manually during the login process.

## THE CHANGE NEEDED
In the session creation for the `/test-script` endpoint, we need to disable the automatic CAPTCHA solving feature.

**FIND THIS (in the `/test-script` endpoint):**
```javascript
const session = await browserbase.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  browserSettings: {
    viewport: { width: 1280, height: 720 },
    fingerprint: {
      devices: ["desktop"],
      locales: ["en-US"],
      operatingSystems: ["windows"]
    }
  },
  proxies: true,
  timeout: 3600
});
```

**REPLACE WITH (CAPTCHA SOLVING DISABLED):**
```javascript
const session = await browserbase.sessions.create({
  projectId: process.env.BROWSERBASE_PROJECT_ID!,
  browserSettings: {
    viewport: { width: 1280, height: 720 },
    fingerprint: {
      devices: ["desktop"],
      locales: ["en-US"],
      operatingSystems: ["windows"]
    },
    // Disable automatic CAPTCHA solving - let user handle manually
    solveCaptchas: false
  },
  proxies: true,
  timeout: 3600
});
```

## WHY THIS HELPS
- ✅ CAPTCHAs will appear normally in the live view
- ✅ User can solve them manually during login
- ✅ No interference from automatic solving attempts
- ✅ More natural login experience
- ✅ Better control over the login process

## RESULT
When CAPTCHAs appear during login, they will be displayed in the live view iframe and you can solve them manually just like a normal user would.