/**
 * Module dependencies
 */

var oidc            = require('../lib/oidc')
  , Client          = require('../models/Client')
  , ClientToken     = require('../models/ClientToken')
  , ValidationError = require('../errors/ValidationError')
  ;


/**
 * Dynamic Client Registration Endpoints
 */

module.exports = function (server) {

  /**
   * Client Registration Endpoint
   */

  server.post('/register',
    oidc.parseAuthorizationHeader,
    oidc.getBearerToken,

    // We'll check downstream for the
    // presence and scope of the token.
    oidc.verifyAccessToken({
      iss: server.settings.issuer,
      key: server.settings.publicKey,
      required: false
    }),

    // rename this for clarity and remove
    // access token verification. Instead,
    // rely on the verifyAccessToken fn.
    oidc.verifyClientRegistration(server),


    function (req, res, next) {

      // client should reference user if possible
      if (req.claims && req.claims.sub) {
        req.body.userId = req.claims.sub;
      }

      Client.insert(req.body, function (err, client) {
        if (err) {
          // QUICK AND DIRTY WRAPPER AROUND MODINHA ERROR
          // CONTEMPLATING A BETTER WAY TO DO THIS.
          return next(
            (err.name === 'ValidationError')
              ? new ValidationError(err)
              : err
          );
        }

        ClientToken.issue({

          iss: server.settings.issuer,
          sub: client._id,
          aud: client._id

        }, server.settings.privateKey, function (err, token) {
          if (err) { return next(err); }

          res.set({
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
          });

          res.json(201, client.configuration(server, token));
        });
      });
    });


  /**
   * Client Configuration Endpoint
   */

  server.get('/register/:clientId',
    oidc.verifyClientToken(server),
    oidc.verifyClientIdentifiers,
    function (req, res, next) {
      Client.get(req.token.payload.sub, function (err, client) {
        if (err) { return next(err); }
        if (!client) { return next(new NotFoundError()); }
        res.json(client.configuration(server));
      });
    });


  server.patch('/register/:clientId',
    oidc.verifyClientToken(server), // should do this or...
    // oidc.verifyClientRegistration(server)
    // with dynamic client registration it should probably stay as is?
    // except what if they pass "trusted"? do we need to add checks for that
    // to `verifyClientToken`?
    // with token/scoped registration we should be using `verifyClientRegistration`?
    oidc.verifyClientIdentifiers,
    function (req, res, next) {
      if (req.is('json')) {
        Client.patch(req.token.payload.sub, req.body, function (err, client) {
          if (err) { return next(err); }
          if (!client) { return next(new NotFoundError()); }
          res.json(client.configuration(server));
        });
      }

      // Wrong Content-type
      else {
        var err = new Error();
        err.error = 'invalid_request';
        err.error_description = 'Content-type must be application/json';
        err.statusCode = 400;
        next(err);
      }
    });


};

