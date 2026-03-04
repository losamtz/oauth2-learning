# OAuth2 Learning: 3-App Demo

This project demonstrates OAuth 2.0 Authorization Code Flow with PKCE using three Node.js apps:

- `auth-server` (Authorization Server) on `http://localhost:3000`
- `client` (OAuth Client / Relying Party) on `http://localhost:4000`
- `resource-server` (Protected API) on `http://localhost:5000`

## Project Structure

```text
oauth2-learning/
  auth-server/
    index.js
    package.json
  client/
    index.js
    package.json
  resource-server/
    index.js
    package.json
```

## OAuth2 Model (What each app does)

### 1) Authorization Server (`auth-server`)

Responsibilities:
- Handles `/authorize` and `/token`
- Validates client, redirect URI, PKCE challenge/verifier
- Issues access tokens and refresh tokens
- Exposes JWKS at `/.well-known/jwks.json` for token signature verification

In-memory stores:
- `clients`: registered OAuth clients
- `authorizationCode`: temporary auth codes
- `refreshTokens`: refresh-token records

Main endpoints:
- `GET /authorize`
- `POST /token`
- `GET /.well-known/jwks.json`

### 2) Client App (`client`)

Responsibilities:
- Starts login (`/login`) by generating PKCE values and redirecting to auth server
- Handles callback (`/callback`) and exchanges code for tokens
- Stores tokens in cookies
- Calls protected resource (`/profile`)
- Refreshes access token (`/refresh`)

Main endpoints:
- `GET /`
- `GET /login`
- `GET /callback`
- `GET /profile`
- `GET /refresh`

### 3) Resource Server (`resource-server`)

Responsibilities:
- Verifies Bearer access tokens via auth server JWKS
- Enforces issuer/audience checks
- Enforces required scope (`api.read`)
- Returns protected profile data

Main endpoint:
- `GET /api/profile`

## End-to-End Flow (Authorization Code + PKCE)

1. User opens `client` and clicks Login.
2. `client` creates:
   - `code_verifier`
   - `code_challenge = SHA256(code_verifier)` (base64url)
   - `state`
3. `client` redirects browser to `auth-server /authorize` with query params:
   - `response_type=code`
   - `client_id`
   - `redirect_uri`
   - `scope` (e.g. `api.read openid profile email`)
   - `state`
   - `code_challenge`, `code_challenge_method=S256`
4. `auth-server` validates request, issues authorization code, redirects back to `client /callback?code=...&state=...`.
5. `client` calls `auth-server /token` with:
   - `grant_type=authorization_code`
   - `code`
   - `redirect_uri`
   - `client_id`
   - `code_verifier`
6. `auth-server` validates PKCE and issues:
   - `access_token`
   - `refresh_token`
7. `client` calls `resource-server /api/profile` with `Authorization: Bearer <access_token>`.
8. `resource-server` verifies JWT via JWKS and checks `api.read` scope.

Refresh flow:
1. `client` sends `grant_type=refresh_token` to `auth-server /token`.
2. `auth-server` validates refresh token and returns a new access token.

## Install and Run

### 1) Install dependencies

From project root:

```bash
cd auth-server && npm install
cd ../client && npm install
cd ../resource-server && npm install
```

### 2) Run all apps (development mode)

Use three terminals:

```bash
# terminal 1
cd auth-server && npm run dev
```

```bash
# terminal 2
cd resource-server && npm run dev
```

```bash
# terminal 3
cd client && npm run dev
```

Then open: `http://localhost:4000`

### 3) Run all apps (start mode)

Use three terminals:

```bash
# terminal 1
cd auth-server && npm start
```

```bash
# terminal 2
cd resource-server && npm start
```

```bash
# terminal 3
cd client && npm start
```

## Notes

- This is a learning/demo setup, not production hardening.
- State, authorization codes, and refresh tokens are stored in memory (lost on restart).
- Keys are local files and not managed by KMS/HSM in this demo.
- Resource server checks that `api.read` is present; extra scopes are allowed.
