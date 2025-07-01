# URGENT FIX: Test Script Timeout Error

## ERROR EXPLANATION
The "Test Script" button is failing because the `/test-script` endpoint still has the wrong timeout value. While you fixed the `/test-connection` endpoint, the new `/test-script` endpoint was created with the same old error.

## THE PROBLEM
In the `/test-script` endpoint, you have:
```javascript
timeout: 3600000 // ❌ WRONG - This is 1,000 hours (exceeds 6-hour limit)
```

## THE FIX
Change it to:
```javascript
timeout: 3600 // ✅ CORRECT - This is 1 hour in seconds
```

## WHERE TO FIX
In `server/routes/test-browser.ts`, find the `/test-script` endpoint and locate this section:

**FIND THIS (WRONG):**
```javascript
router.post("/test-script", async (req, res) => {
  try {
    // ... other code ...
    
    const session = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        context: { persist: true },
        viewport: { width: 1280, height: 720 },
        fingerprint: {
          devices: ["desktop"],
          locales: ["en-US"],
          operatingSystems: ["windows"]
        }
      },
      proxies: true,
      timeout: 3600000 // ❌ CHANGE THIS LINE
    });
```

**CHANGE TO (CORRECT):**
```javascript
router.post("/test-script", async (req, res) => {
  try {
    // ... other code ...
    
    const session = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserSettings: {
        context: { persist: true },
        viewport: { width: 1280, height: 720 },
        fingerprint: {
          devices: ["desktop"],
          locales: ["en-US"],
          operatingSystems: ["windows"]
        }
      },
      proxies: true,
      timeout: 3600 // ✅ FIXED - Remove 3 zeros
    });
```

## WHAT HAPPENED
1. You clicked "Test Script"
2. Frontend called `/api/test-browser/test-script`
3. Backend tried to create session with `timeout: 3600000`
4. Browserbase rejected it (exceeds 21,600 second limit)
5. Error: "BadRequestError: 400 body/timeout must be <= 21600"

## AFTER THE FIX
1. Click "Test Script" 
2. Session will create successfully
3. Browser will navigate to Twitter login
4. Manual intervention will work properly
5. Automation will continue after login

**SIMPLE FIX**: Just remove 3 zeros from the timeout value in the test-script endpoint!