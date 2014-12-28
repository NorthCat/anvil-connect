/**
 * Module dependencies
 */

var client                = require('../config/redis')
  , bcrypt                = require('bcrypt')
  , CheckPassword         = require('mellt').CheckPassword
  , Modinha               = require('modinha')
  , Document              = require('modinha-redis')
  , PasswordRequiredError = require('../errors/PasswordRequiredError')
  , InsecurePasswordError = require('../errors/InsecurePasswordError')
  , _                     = require('lodash')
  ;


/**
 * User model
 */

var User = Modinha.define('users', {

  // OpenID Connect Standard Claims
  //
  // NOTE: The "sub" claim is stored as `_id`.
  //       Expose it as `sub` via mappings.
  name:                 { type: 'string' },
  givenName:            { type: 'string' },
  familyName:           { type: 'string' },
  middleName:           { type: 'string' },
  nickname:             { type: 'string' },
  preferredUsername:    { type: 'string' },
  profile:              { type: 'string' },
  picture:              { type: 'string' },
  website:              { type: 'string' },
  email:                {
                          type:     'string',
                          //required: true,
                          unique:   true,
                          format:   'email'
                        },
  emailVerified:        { type: 'boolean', default: false },
  gender:               { type: 'string' },
  birthdate:            { type: 'string' },
  zoneinfo:             { type: 'string' },
  locale:               { type: 'string' },
  phoneNumber:          { type: 'string' },
  phoneNumberVerified:  { type: 'boolean', default: false },
  address:              { type: 'object' },

  // Hashed password
  hash:                 {
                          type:    'string',
                          private: true,
                          set:     hashPassword
                        },

  // Third Party Credentials

  angellistId:            { type: 'number', unique: true },
  angellistAccessToken:   { type: 'string' },
  bufferId:               { type: 'string', unique: true },
  bufferAccessToken:      { type: 'string' },
  dropboxId:              { type: 'number', unique: true },
  dropboxAccessToken:     { type: 'string' },
  facebookId:             { type: 'string', unique: true },
  facebookAccessToken:    { type: 'string' },
  foursquareId:           { type: 'string', unique: true },
  foursquareAccessToken:  { type: 'string' },
  githubId:               { type: 'number', unique: true },
  githubAccessToken:      { type: 'string' },
  googleId:               { type: 'string', unique: true },
  googleAccessToken:      { type: 'string' },
  instagramId:            { type: 'string', unique: true },
  instagramAccessToken:   { type: 'string' },
  mailchimpId:            { type: 'string', unique: true },
  mailchimpAccessToken:   { type: 'string' },
  soundcloudId:           { type: 'number', unique: true },
  soundcloudAccessToken:  { type: 'string' },
  twitchId:               { type: 'number', unique: true },
  twitchAccessToken:      { type: 'string' },
  twitterId:              { type: 'number', unique: true },
  twitterAccessToken:     { type: 'string' },
  wordpressId:            { type: 'number', unique: true },
  wordpressAccessToken:   { type: 'string' },




});


/**
 * Hash Password Setter
 */

function hashPassword (data) {
  var password = data.password
    , hash     = data.hash
    ;

  if (password) {
    var salt = bcrypt.genSaltSync(10);
    hash = bcrypt.hashSync(password, salt);
  }

  this.hash = hash;
}


/**
 * UserInfo Mapping
 */

User.mappings.userinfo = {
  '_id':                  'sub',
  'name':                 'name',
  'givenName':            'given_name',
  'familyName':           'family_name',
  'middleName':           'middle_name',
  'nickname':             'nickname',
  'preferredUsername':    'preferred_username',
  'profile':              'profile',
  'picture':              'picture',
  'website':              'website',
  'email':                'email',
  'emailVerified':        'email_verified',
  'gender':               'gender',
  'birthdate':            'birthdate',
  'zoneinfo':             'zoneinfo',
  'locale':               'locale',
  'phoneNumber':          'phone_number',
  'phoneNumberVerified':  'phone_number_verified',
  'address':              'address',
  'created':              'joined_at',
  'modified':             'updated_at'
};

/**
 * profile scope Mapping #5.4
 */

User.mappings.profile = {
  '_id':                  'sub',
  'name':                 'name',
  'givenName':            'given_name',
  'familyName':           'family_name',
  'middleName':           'middle_name',
  'nickname':             'nickname',
  'preferredUsername':    'preferred_username',
  'profile':              'profile',
  'picture':              'picture',
  'website':              'website',
  'gender':               'gender',
  'birthdate':            'birthdate',
  'zoneinfo':             'zoneinfo',
  'locale':               'locale',
  'created':              'joined_at',
  'modified':             'updated_at'
};


/**
 * email scope Mapping #5.4
 */

User.mappings.email = {
  '_id':                  'sub',
  'email':                'email',
  'emailVerified':        'email_verified',
  'created':              'joined_at',
  'modified':             'updated_at'
};

/**
 * phone scope Mapping #5.4
 */

User.mappings.phone = {
  '_id':                  'sub',
  'phoneNumber':          'phone_number',
  'phoneNumberVerified':  'phone_number_verified',
  'created':              'joined_at',
  'modified':             'updated_at'
};


/**
 * address scope Mapping #5.4
 */

User.mappings.address = {
  '_id':                  'sub',
  'address':              'address',
  'created':              'joined_at',
  'modified':             'updated_at'
};


/**
 * Document persistence
 */

User.extend(Document);
User.__client = client;


/**
 * User intersections
 */

User.intersects('roles');


/**
 * Authorized scope
 */

User.prototype.authorizedScope = function (callback) {
  var client   = User.__client
    , defaults = ['openid', 'profile']
    ;

  client.zrange('users:' + this._id + ':roles', 0, -1, function (err, roles) {
    if (err) { return callback(err); }

    if (!roles || roles.length === 0) {
      return callback(null, defaults);
    }

    var multi = client.multi();

    roles.forEach(function (role) {
      multi.zrange('roles:' + role + ':scopes', 0, -1);
    });

    multi.exec(function (err, results) {
      if (err) { return callback(err); }
      callback(null, [].concat.apply(defaults, results));
    });

  });
};


/**
 * Scoped UserInfo
 */

User.prototype.scopedUserInfo = function(scopes) {
  var mapping = {'_id': 'sub'};
  if (_.isString(scopes)) { scopes = scopes.split(' '); }
  if (_.isArray(scopes) && scopes.length > 0) {
    scopes.forEach(function (scope) {
      if (_.has(User.mappings, scope)) {
        mapping = _.assign(mapping, User.mappings[scope]);
      }
    });
  }
  return this.project(mapping);
};


/**
 * Verify password
 */

User.prototype.verifyPassword = function (password, callback) {
  if (!this.hash) { return callback(null, false); }
  bcrypt.compare(password, this.hash, callback);
};


/**
 * Create
 */

User.insert = function (data, options, callback) {
  var collection = User.collection;

  if (!callback) {
    callback = options;
    options = {};
  }

  if (options.password !== false) {
    // require a password
    if (!data.password) {
      return callback(new PasswordRequiredError());
    }

    // check the password strength
    if (CheckPassword(data.password) === -1) {
      return callback(new InsecurePasswordError());
    }
  }

  // create an instance
  var user = User.initialize(data, { private: true })
    , validation = user.validate()
    ;

  // pick up mapped values
  if (options.mapping) {
    user.merge(data, { mapping: options.mapping });
  }

  // require a valid user
  if (!validation.valid) {
    return callback(validation);
  }

  // catch duplicate values
  User.enforceUnique(user, function (err) {
    if (err) { return callback(err); }

    // batch operations
    var multi = User.__client.multi()

    // store the user
    multi.hset(collection, user._id, User.serialize(user))

    // index the user
    User.index(multi, user);

    // execute ops
    multi.exec(function (err) {
      if (err) { return callback(err); }
      callback(null, User.initialize(user));
    });
  });
};


/**
 * Authenticate
 */

User.authenticate = function (email, password, callback) {
  User.getByEmail(email, { private: true }, function (err, user) {
    if (!user) {
      return callback(null, false, {
        message: 'Unknown user.'
      });
    }

    user.verifyPassword(password, function (err, match) {
      if (match) {
        callback(null, User.initialize(user), {
          message: 'Authenticated successfully!'
        });
      } else {
        callback(null, false, {
          message: 'Invalid password.'
        });
      }
    })
  })
};



/**
 * Get by provider profile (Passport callback profile)
 */

User.getByProviderProfile = function (provider, profile, options, callback) {
  var index = User.collection + ':' + provider + 'Id';

  if (typeof callback !== 'function') {
    callback = options;
    options = {}
  }

  User.__client.hget(index, profile.id, function (err, id) {
    if (err) { return callback(err); }

    User.get(id, options, function (err, instance) {
      if (err) { return callback(err); }
      callback(null, instance);
    });
  });
};


/**
 * Connect
 */

User.connect = function (options, callback) {
  var provider  = options.provider
    , provKey   = provider + 'Id'
    , provToken = provider + 'AccessToken'
    , user      = options.user
    , token     = options.token
    , secret    = options.secret
    , profile   = options.profile
    , update    = {}
    ;

  // prepare the update object
  update[provKey] = profile.id;
  update[provToken] = token;

  profile[provKey] = profile.id;
  profile[provToken] = token;

  // connect to authenticated user
  if (user) {
    User.patch(user._id, update, function (err, user) {
      if (err) { return callback(err); }
      callback(null, user);
    })
  }

  // connect to unauthenticated user
  else {

    User.getByProviderProfile(provider, profile, function (err, user) {

      // create a new user
      if (!user) {
        User.insert(profile, {
          mapping:  provider,
          password: false
        }, function (err, user) {
          if (err) { return callback(err); }
          callback(null, user);
        });
      }

      // update an existing user
      else {
        User.patch(user._id, update, function (err, user) {
          if (err) { return callback(err); }
          callback(null, user);
        });
      }

    });

  }
};


/**
 * Errors
 */

User.PasswordRequiredError = PasswordRequiredError;
User.InsecurePasswordError = InsecurePasswordError;


/**
 * Exports
 */

module.exports = User;
