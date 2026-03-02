# Create Keys with openssl

Create private key to be able to generate a signed accesstoken and refresh token.
Create a public key to be able to deliver to the resource server which will fetch it/ ask for it with path `/.well-known/jwks.json`

## Private key generation

***Step 1***

- Generates a 2048-bit RSA private key
- Saves it in PKCS#1 format
- Writes it to private.pem

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
```

***Step 2***

- Converts the RSA key from PKCS#1 → PKCS#8 format
- Leaves it unencrypted (-nocrypt)
- Outputs to private_pkcs8.pem

Note:   PKCS#8 is just a standardized container format for private keys.
        Many libraries (Java, Node jose, OAuth private_key_jwt) prefer PKCS#8.

```bash
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in private.pem -out private_pkcs8.pem
```

This exact pattern is commonly used for:

- OAuth 2.0 private_key_jwt authentication
- JWT signing (RS256)
- Creating a JWK
- mTLS setups
- API signature systems
