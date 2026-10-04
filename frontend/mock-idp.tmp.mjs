import { OAuth2Server } from "oauth2-mock-server";
import { createServer } from "node:http";
const idp = new OAuth2Server();
await idp.issuer.keys.generate("RS256");
await idp.start(8091, "localhost");
idp.service.on("beforeTokenSigning", (token) => {
  Object.assign(token.payload, { name: "Anna Beispiel", email: "anna@example.com", realm_access: { roles: ["user"] } });
});
createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  res.end(
    JSON.stringify({ sub: "johndoe", auth: req.headers.authorization ?? null, cookie: req.headers.cookie ?? null }),
  );
}).listen(8092, "127.0.0.1");
console.log("idp", idp.issuer.url, "backend 8092");
