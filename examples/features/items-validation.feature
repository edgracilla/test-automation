@example @validation
Feature: Item validation and authorization
  Shows Scenario Outlines, empty cells (field left out) and switching identities.

  Scenario Outline: Reject an invalid item (<case>)
    Given I am authenticated as "admin"
    When I send a POST request to "/items" with the following details
      | name   | price:number | tags:json |
      | <name> | <price>      | <tags>    |
    Then the response status is 400
    And the response has the following values
      | path          | value      | condition |
      | error.code    | VALIDATION |           |
      | error.message | <message>  | contains  |

    Examples:
      | case             | name  | price | tags     | message      |
      | missing name     |       | 10    |          | name         |
      | missing price    | Chair |       |          | price        |
      | negative price   | Chair | -1    |          | price        |
      | tags not a list  | Chair | 10    | "red"    | tags         |

  Scenario: Viewers can read but not write
    Given I am authenticated as "viewer"
    When I send a GET request to "/me"
    Then the response status is 200
    And the response value "role" is "viewer"
    When I send a POST request to "/items" with payload "items/create"
    Then the response status is 403

  Scenario: Anonymous requests are rejected
    Given I am not authenticated
    When I send a DELETE request to "/items/itm_1"
    Then the response status is 401
    And the response value "error.code" is "UNAUTHENTICATED"
