# test-automation

A config-driven BDD template for testing any HTTP/JSON API with [Cucumber](https://github.com/cucumber/cucumber-js).
You write scenarios in Gherkin with a fixed set of generic steps. Everything specific to your API
(base URLs, how to sign in, default request bodies) lives in one config file, so the same template
works for any service.

```gherkin
Scenario: Create and read a product
  Given I am authenticated as "admin"
  And I have the following details
    | name                | price:number |
    | ${$randomString(8)} | 150          |
  When I send a POST request to "/products" with payload "products/create"
  Then the response status is 201
  And I store the response id as "productId"
  And after the scenario, I send a DELETE request to "/products/${productId}"

  When I send a GET request to "/products/${productId}"
  Then the response has the following values
    | path  | value   | type   | condition |
    | id    |         |        | exists    |
    | name  | ${name} |        |           |
    | price | 150     | number |           |
```

## Quick start

Requires Node 20.12+ and pnpm.

```bash
pnpm install
```

```bash
pnpm test:example
```

`test:example` starts a small mock API (`examples/mock-server.js`) and runs the example features against it.
The `examples/` folder shows every feature in use.

To test your own API:

1. `cp .env.example .env` and set `API_URL` (plus any credentials).
2. Edit [config/test.config.js](config/test.config.js): services, auth profiles, templates.
3. Add `.feature` files under `features/`, payload templates under `payloads/`, JSON schemas under `schemas/`.
4. Run `pnpm test`.

## Running

| Command | What it does |
| --- | --- |
| `pnpm test` | Run everything under `features/` |
| `pnpm test features/users` | Run one folder or file |
| `pnpm test --tags @smoke` | Run scenarios by tag (`"@users and not @slow"` works too) |
| `pnpm test --parallel 4` | Run scenarios in 4 workers |
| `TEST_ENV=staging pnpm test` | Load `.env.staging` on top of `.env` |
| `LOG_HTTP=1 pnpm test` | Print every request and its status |
| `pnpm test:unit` | Unit tests for the template's own engine |

Reports go to `reports/cucumber-report.html` (with the last request/response attached to each failure)
and `reports/junit.xml` for CI.

## Layout

```
config/test.config.js   services, auth profiles, templates, custom functions
features/               your .feature files
payloads/               JSON request body templates
schemas/                JSON schemas for response validation
src/                    the engine (steps, HTTP client, auth, interpolation, assertions)
examples/               mock API + example config, features, payloads, schemas
```

`pnpm-workspace.yaml` makes this folder its own pnpm root, so a workspace file in a parent folder doesn't capture it.

## Environments

Values are read from, highest priority first:

1. the shell (`API_URL=... pnpm test`)
2. `.env.<TEST_ENV>`, e.g. `.env.dev` or `.env.staging`
3. `.env`

`TEST_ENV` itself can be set in the shell or in `.env`. All `.env*` files except `.env.example` are git-ignored.
To point at a different config file entirely, set `TEST_CONFIG=path/to/config.js`.

## Configuration

`config/test.config.js` exports an object (or a function `({ env }) => object`, where `env` is `TEST_ENV`).
Any string in it may contain placeholders such as `${env:API_URL}`; they are resolved when used.

### Services

```js
defaultService: 'api',
services: {
  api:      { baseUrl: '${env:API_URL}', headers: { Accept: 'application/json' }, timeoutMs: 30000, idPath: 'id' },
  payments: { baseUrl: '${env:PAYMENTS_URL}', idPath: 'data.id' },
},
```

Steps use `defaultService` until a scenario says `Given I use the "payments" service`.
`idPath` is where `I store the response id as "..."` finds the id (`_id`, `data.id`, ...).
A step path that is a full URL (`https://...`) skips the base URL.

### Auth profiles

`Given I am authenticated as "<profile>"` signs in with a profile. Credentials are cached for the run
(refreshed when a JWT or OAuth token is about to expire). `I force log in as "<profile>"` skips the cache.
By default a profile's credentials go to every service; `services: ['api']` limits them, which lets
several identities be active at once (e.g. a user token for one API and an API key for another).

| type | Options |
| --- | --- |
| `bearer` | `token` |
| `basic` | `username`, `password` |
| `apiKey` | `name` (default `x-api-key`), `value`, `in: 'header' \| 'query'` |
| `login` | `request: { method, path, body, query, headers, service }`, then `tokenPath` (in the body, default `token`), `tokenHeader` (in a response header) or `cookies: true` |
| `oauth2` | `tokenUrl`, `clientId`, `clientSecret`, `scope`, `audience`, `grantType` (default `client_credentials`), `params` |
| `custom` | `authenticate({ send, resolve, env, vars, decodeJwt })` returning `{ headers, query, vars, expiresAt }` |

Options shared by token types: `header` (default `Authorization`), `scheme` (default `Bearer`; `''` sends the bare token),
`claims: { varName: 'claim' }` to copy JWT claims into variables (claims are decoded, not verified), `services`,
and `reuse: false` to sign in every time. `login` also takes `capture: { varName: 'path.in.response' }`.

```js
auth: {
  owner: {
    type: 'login',
    request: { method: 'POST', path: '/auth/login', body: { email: '${env:OWNER_EMAIL}', password: '${env:OWNER_PASSWORD}' } },
    tokenPath: 'authToken',
    claims: { session_userId: 'userId', session_shopId: 'shopId' },
  },
},
```

### Templates

Default bodies for requests whose step gives none. Keys are `"METHOD path"` (or just `"path"`) written exactly as in the step;
values are files under `payloads/` without `.json`:

```js
templates: {
  'POST /products': 'products/create',
  'PATCH /products/${productId}': 'products/update',
},
```

### Custom functions

```js
functions: {
  sku: (prefix = 'SKU') => `${prefix}-${Date.now()}`,
},
```

Use them as `${$sku}` or `${$sku('A')}`.

## Values and placeholders

Placeholders work in step paths, tables, doc strings, payload templates and config values.

| Placeholder | Resolves to |
| --- | --- |
| `${name}` | a scenario variable |
| `${user.address.city}` | a path inside a stored object |
| `${env:NAME}` | an environment variable |
| `${$uuid}` | generated UUID |
| `${$randomString(8)}` / `${$randomString(8, 'p-')}` | random hex string with a prefix (default `test-`) |
| `${$randomInt(1, 100)}`, `${$randomFloat(0, 1, 2)}`, `${$randomBool}` | random numbers / boolean |
| `${$randomEmail}` / `${$randomEmail('my.org')}`, `${$randomPhone('+63', 10)}` | random contact details |
| `${$pick('a', 'b', 'c')}` | one of the arguments |
| `${$now}`, `${$timestamp}`, `${$date(-7)}` | ISO time, epoch ms, `YYYY-MM-DD` shifted by days |
| `${$empty}`, `${$null}` | an explicit `""` or `null` |

Rules:

- A value that is exactly one placeholder keeps its type (`"${price}"` sends the number `150`, not `"150"`).
- Inside longer text, placeholders become text (`"/shops/${shopId}/items"`).
- In payload templates, a placeholder for an unset variable leaves the field out; in arrays the item is
  dropped (so `["${tag_1}", "${tag_2}"]` with only `tag_1` set sends one tag).
- In paths, headers and assertions, an unset variable is an error, which catches typos.
- `${__getRandom('string')}` style from older suites still works.

### Tables

Column headers are paths with an optional type: `name`, `price:number`, `active:boolean`, `meta:json`,
`address.city`, `items[0].sku`, `tags[]` (append). Types: `string`, `number`, `int`, `boolean`, `json`.
Empty cells are left out, which makes Scenario Outlines for "missing field" cases easy.
A request table with several rows sends an array of objects.

## Steps

### Setup

```gherkin
Given I have the following details          # one row; each column becomes a variable (empty cell removes it)
Given I set "name" to "value"
Given I use the "payments" service
Given I set the header "X-Tenant" to "${tenantId}"
Given I have the following headers          # two columns: name | value
Given I remove the header "X-Tenant"
Given I wait 2 seconds
Given I print the response                  # debugging: logs the last exchange
Given I print the variables
```

### Auth

```gherkin
Given I am authenticated as "admin"         # alias: I am logged in as "admin"
Given I force log in as "admin"             # alias: I am freshly authenticated as "admin"
Given I am not authenticated                # alias: I log out
```

### Requests

```gherkin
When I send a GET request to "/products/${productId}"
When I send a POST request to "/products"                          # body from config.templates, if any
When I send a POST request to "/products" with payload "products/create"
When I send a POST request to "/products" with body:
  """
  { "name": "${name}", "price": 150 }
  """
When I send a PATCH request to "/products/${productId}" with the following details
  | name    | price:number |
  | Renamed | 250          |
When I send a GET request to "/products" with query params
  | search  | limit |
  | ${name} | 10    |
```

Any method works: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. Bodies are sent as JSON unless you set
`Content-Type` to `application/x-www-form-urlencoded` (or send a non-JSON doc string).

### Storing values

```gherkin
Then I store the response id as "productId"                  # uses the service's idPath
Then I store the response value "data.items.0.id" as "firstId"
Then I store the response header "location" as "location"
Then after the scenario, I send a DELETE request to "/products/${productId}"
```

Cleanup requests run after the scenario, last registered first, even when the scenario fails,
with the identity that was active when they were registered. A 404 during cleanup is ignored.

### Assertions

```gherkin
Then the response status is 201
Then the response status is one of "200, 204"
Then the response value "name" is "${name}"
Then the response value "deletedAt" exists
Then the response value "password" does not exist
Then the response matches the schema "product"      # schemas/product.json (draft-07, 2019-09 or 2020-12)
Then the response header "content-type" contains "json"
Then the response header "cache-control" is "no-store"
Then the response time is below 500 ms
Then the response body contains                     # partial match; extra fields are ignored
  """
  { "name": "${name}", "tags": ["sale"] }
  """
Then the response has the following values
  | path         | value      | type    | condition |
  | id           |            |         | exists    |
  | price        | 150        | number  |           |
  | active       | true       | boolean |           |
  | tags         | sale       |         | contains  |
  | tags.length  | 1          |         | >=        |
  | code         | ^PRD-\d+$  |         | matches   |
  | status       | new, open  |         | one of    |
  | items        | array      |         | type      |
  | errors       |            |         | empty     |
```

Paths use dots or brackets (`data.items.0.id`, `data.items[0].id`, `$.data`); `length` works on arrays and strings,
and an empty path is the whole body. All rows are checked and every failure is reported together.

Conditions: `equals` (default), `not equals`, `exists`, `not exists`, `contains`, `not contains`, `matches`,
`one of`, `type`, `empty`, `not empty`, `length`, `>`, `>=`, `<`, `<=`.

Without a `type`, the expected value is converted to the actual value's type when possible, so `150` matches
the number `150`. Set `type` to `string` to require the string `"150"`.

## Adding your own steps

Add a file under `src/steps/`. Steps get the scenario's World as `this`:

```js
import { When } from '@cucumber/cucumber';

When('I upload the avatar for {string}', async function (userVar) {
  await this.send({ method: 'PUT', path: `/users/${this.vars.get(userVar)}/avatar`, body: { url: 'https://...' } });
});
```

Useful members: `this.send({ method, path, body, query, headers, service })`, `this.response`
(`status`, `headers`, `body`, `text`, `durationMs`), `this.vars` (a `Map`), `this.resolve(value)` for placeholders,
`this.authenticate(profile)`, `this.headers`, `this.service`.

## Migrating from elves-test-automation

| Old step | New step |
| --- | --- |
| `I logged in as "admin" in "web-admin"` | `I am authenticated as "admin"` (put the origin in the profile's `request.query`) |
| `I force log in as "admin" in "web-admin"` | `I force log in as "admin"` |
| `call post "/v3/products"` | `I send a POST request to "/v3/products"` (template from `config.templates`) |
| `call get "/v3/products" using "productId"` | `I send a GET request to "/v3/products/${productId}"` |
| `call get "/v3/products" with url params` | `I send a GET request to "/v3/products" with query params` |
| `call patch "/v3/products" using "id" with the following details` | `I send a PATCH request to "/v3/products/${id}" with the following details` |
| `call delete "/v3/products" using "id"` | `I send a DELETE request to "/v3/products/${id}"` |
| `add response id to "productId"` | `I store the response id as "productId"` (set `idPath: '_id'`) |
| `set test data "x" with value from response "a.b"` | `I store the response value "a.b" as "x"` |
| `set id "x" to "value"` | `I set "x" to "value"` |
| `sleep for 2 seconds` | `I wait 2 seconds` |
| `verify response code is 200` | `the response status is 200` |
| `verify the following response values` (`objPath` column) | `the response has the following values` (`objPath` still accepted) |

`I have the following details` and `${__getRandom(...)}` keep working. One difference: an empty cell now
removes the variable, so a template field that uses it is left out instead of being sent as `""`.
