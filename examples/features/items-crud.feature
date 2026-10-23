@example @crud
Feature: Item CRUD
  Shows the core flow: authenticate, create from a payload template, store the id,
  read, update, delete, and clean up even if a step fails.

  Background:
    Given I am authenticated as "admin"

  Scenario: Create, read, update and delete an item
    Given I have the following details
      | name                | price:number | tag_1 | tag_2 | tag_3 | sku           |
      | ${$randomString(6)} | 150          | new   | sale  |       | ${$sku('EX')} |
    # No body in the step: config.templates maps "POST /items" to payloads/items/create.json
    When I send a POST request to "/items"
    Then the response status is 201
    And the response matches the schema "item"
    And I store the response id as "itemId"
    And after the scenario, I send a DELETE request to "/items/${itemId}"
    And the response has the following values
      | path         | value             | type    | condition |
      | id           |                   |         | exists    |
      | name         | ${name}           |         |           |
      | price        | 150               | number  |           |
      | tags         | ["new","sale"]    | json    |           |
      | tags.length  | 2                 |         |           |
      | details.sku  | ^EX-              |         | matches   |
      | details      |                   |         | not empty |
      | active       | true              | boolean |           |
      | createdBy    | ${session_userId} |         |           |

    When I send a GET request to "/items/${itemId}"
    Then the response status is 200
    And the response value "name" is "${name}"

    When I send a PATCH request to "/items/${itemId}" with the following details
      | name         | price:number | tags[0]  | tags[1] | details.color |
      | Renamed item | 99.5         | featured | clear   | red           |
    Then the response status is 200
    And the response body contains
      """
      { "name": "Renamed item", "price": 99.5, "tags": ["clear", "featured"], "details": { "color": "red" } }
      """

    When I send a DELETE request to "/items/${itemId}"
    Then the response status is 204
    When I send a GET request to "/items/${itemId}"
    Then the response status is 404

  Scenario: Create with an inline JSON body and search for it
    Given I set "token" to "${$uuid}"
    When I send a POST request to "/items" with body:
      """
      {
        "name": "Lamp ${token}",
        "price": 42,
        "tags": ["home"]
      }
      """
    Then the response status is 201
    And I store the response id as "lampId"
    And after the scenario, I send a DELETE request to "/items/${lampId}"

    When I send a GET request to "/items" with query params
      | name     | tag  | limit |
      | ${token} | home | 10    |
    Then the response status is 200
    And the response has the following values
      | path        | value     | condition |
      | total       | 1         |           |
      | data        | array     | type      |
      | data.0.id   | ${lampId} |           |
      | data.0.name | Lamp      | contains  |
