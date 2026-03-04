import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import { randomBytes, createHash } from "crypto";
import { SignJWT, exportJWK, importPKCS8, importSPKI } from "jose";
import fs from "fs";


const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

const clients = new Map();
const authorizationCode = new Map();
const refreshTokens = new Map();

clients.set("demo-client", {
    clientId: "demo-client",
    redirectUris: ["http://localhost:4000/callback"]
});

const PRIVATE_KEY_PEM = fs.readFileSync("./private.pem", "utf8");
const PUBLIC_KEY_PEM = fs.readFileSync("./public.pem", "utf8");


const ISSUER = "http://localhost:3000";
const KEY_ID = "demo-key-1";

function base64url(input) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sha256Base64url(str) {
  const hash = createHash("sha256").update(str).digest();
  return base64url(hash);
}

function generateCode() {
  return base64url(randomBytes(32));
}

function getDemoUser() {
  return {
    sub: "alice",
    name: "Alice chain",
    email: "alice@example.com"
  };
}

app.get("/authorize", (req, res) => {
    const { 
        response_type, 
        client_id, 
        redirect_uri, 
        scope = "", 
        state, 
        code_challenge, 
        code_challenge_method
    } = req.query;

    // Basic validation
    const client = clients.get(client_id);
    if (!client) {
        return res.status(400).send("Unknown client_id");
    }
    if (!client.redirectUris.includes(redirect_uri)) {
        return res.status(400).send("Unknown redirect_uri");
    }
    if (response_type !== "code") {
        return res.status(400).send("Unsupported response_type");
    }
    if (!code_challenge || code_challenge_method !== "S256") {
        return res.status(400).send("PKCE required: code_challenge and code_challenge_method=S256");
    }
    // Simulate user authentication (in a real app, you'd show a login page)
    // Normally: show login + consent UI.
    // For tutorial simplicity: auto-login + consent
    const user = getDemoUser();

    // Generate authorization code
    const code = generateCode();
    authorizationCode.set(code, {
        clientId: client_id,
        redirectUri: redirect_uri,
        codeChallenge: code_challenge,
        scope,
        user,
        expiredAt: Date.now() + 5 * 60 * 1000 // Code valid for 5 minutes
    });

    // Redirect back to client with code and state
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if(state) redirectUrl.searchParams.set("state", state);

    res.redirect(redirectUrl.toString());
});

/**
 * POST /token
 * Supports:
 * - grant_type=authorization_code
 * - grant_type=refresh_token
 */
// 
app.post("/token", async (req, res) => {

    const { grant_type } = req.body;

    if (grant_type === "authorization_code") {
        const { code, redirect_uri, client_id, code_verifier } = req.body;

        // code, redirect_uri, client_id, code_verifier are required
        const record = authorizationCode.get(code);
        if (!record ) return res.status(400).json ( { error: "invalid_request", error_description: "Missing code" });
        if (record.expiredAt < Date.now()) {
            authorizationCode.delete(code);
            return res.status(400).json ( { error: "invalid_request", error_description: "Code expired" });
        }
        if (record.clientId !== client_id || record.redirectUri !== redirect_uri) return res.status(400).json ( { error: "invalid_request", error_description: "Invalid client_id or redirect_uri" });

        // PKCE validation
        const computedChallenge = sha256Base64url(code_verifier);
        if (computedChallenge !== record.codeChallenge) {
        return res.status(400).json({ error: "invalid_grant", error_description: "PKCE validation failed" });
        }

        // One-time use code
        authorizationCode.delete(code);

        // Create JWT access token
        const privateKey = await importPKCS8(PRIVATE_KEY_PEM, "RS256");

        const accessToken = await new SignJWT({
            scope: record.scope,
            name: record.user.name,
            email: record.user.email
        })
        .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
        .setIssuer(ISSUER)
        .setAudience(client_id)
        .setSubject(record.user.sub)
        .setExpirationTime("15m")
        .sign(privateKey);

        
        // Create refresh token
        const refresh_token = generateCode();
        refreshTokens.set(refresh_token, {
            sub: record.user.sub,
            scope: record.scope,
            clientId: client_id
        });
        

        return res.json({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 15 * 60, // 15 minutes
            refresh_token,
            scope: record.scope
        });
    }

    if (grant_type === "refresh_token") {
        const { refresh_token, client_id } = req.body;
        const record = refreshTokens.get(refresh_token);
        if (!record) return res.status(400).json({ error: "invalid_grant", error_description: "Invalid refresh token" });
        if (record.clientId !== client_id) return res.status(400).json({ error: "invalid_grant", error_description: "Invalid client_id" });

        // Create new access token
        const privateKey = await importPKCS8(PRIVATE_KEY_PEM, "RS256");
        const accessToken = await new SignJWT({
            scope: record.scope,
            name: record.name,
            email: record.email
        })
            .setProtectedHeader({ alg: "RS256", kid: KEY_ID })
            .setIssuer(ISSUER)
            .setAudience(client_id)
            .setSubject(record.sub)
            .setExpirationTime("15m")
            .sign(privateKey);

        return res.json({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 15 * 60, // 15 minutes
        });
    }

    res.status(400).json({ error: "unsupported_grant_type", error_description: "Only authorization_code grant is supported in this demo" });
    
});

app.get("/.well-known/jwks.json", async (req, res) => {

    const publicKey = await importSPKI(PUBLIC_KEY_PEM, "RS256");
    const jwk = await exportJWK(publicKey);

    jwk.use = "sig";
    jwk.alg = "RS256";
    jwk.kid = KEY_ID;

    res.json({ 
        keys: [jwk] 
    });
});

app.listen(3000, () => {
  console.log("Authorization server running on http://localhost:3000");
});
