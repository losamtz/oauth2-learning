import express from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";

const app = express();
app.use(express.json());


const ISSUER = "http://localhost:3100";
const AUDIENCE = "mimic-acx-client";
const JWKS_URL = new URL( `${ISSUER}/.well-known/jwks.json`);

const JWKS = createRemoteJWKSet(JWKS_URL);

async function requireAuth(req, res, next) {

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
        return res.status(401).json({ error: "missing_token" });
    }

    const token = auth.slice("Bearer ".length);

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: ISSUER,
            audience: AUDIENCE,
        });
        req.user = payload;
        next();
    } catch (err) {
        console.error(err);
        res.status(401).json({ error: "invalid_token", message: err.message });
    }
}

function requireScope(scope) {
    return (req, res, next) => {

        const scopes = String(req.user.scope || "").split(" ").filter(Boolean);

        if (!scopes.includes(scope)) {
            return res.status(403).json({ error: "insufficient_scope", reqquired: scope });
        }
        next();
    }
}

app.get("/api/profile", requireAuth, requireScope("api.read"), (req, res) => {
    res.json({ 
        message: "Protected profile information", 
        user: {
            sub: req.user.sub,
            name: req.user.name,
            email: req.user.email,
            scope: req.user.scope
        } 
    });
});

app.listen(4100, () => {
    console.log("Resource server running on http://localhost:4100");
});
