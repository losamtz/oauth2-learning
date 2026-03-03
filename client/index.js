import express from "express";
import cookieParser from "cookie-parser";
import axis from "axios";
import { randomBytes, createhash } from "crypto";

const app = express();
app.use(cookieParser());

const AUTH_SERVER = "http://localhost:3000";
const RESOURCE_SERVER = "http://localhost:5000";

const CLIENT_ID = "demo-client";
const REDIRECT_URI = "http://localhost:4000/callback";

// helpers
function base64url(input) {
    return input.toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function generateVerifier() {
    return base64url(randomBytes(32));
}

function codeChallengeS256(verifier) {
    const hash = createhash("sha256").update(verifier).digest();
    return base64url(hash);
}
function generateState() {
    return base64url(randomBytes(16));
}

app.get(("/"), (req, res) => {
    res.send(`
        <h1>Demo Client</h1>
        <p>This app uses Authorization Code + PKCE.</p>
        <a href="/login">Login with Authorization Server</a>
    `);
});

app.get("/login", (req, res) => {
    const code_verifier = generateVerifier();
    const code_challenge = codeChallengeS256(code_verifier);
    const state = generateState();


});

app.listen(4000, () => {
    console.log("Client running on http://localhost:4000");
});