@example @services
Feature: Several services in one scenario
  The "admin" profile applies to the store service and the "reportsKey" API key to the
  reports service, so both stay active at the same time.

  Scenario: Create an item, then read the report from another service
    Given I am authenticated as "admin"
    And I am authenticated as "reportsKey"
    When I send a POST request to "/items" with the following details
      | name                | price:number |
      | ${$randomString(6)} | 5            |
    Then the response status is 201
    And I store the response id as "itemId"
    And after the scenario, I send a DELETE request to "/items/${itemId}"

    Given I use the "reports" service
    When I send a GET request to "/summary"
    Then the response status is 200
    And the response time is below 2000 ms
    And the response header "content-type" contains "application/json"
    And I store the response header "x-request-id" as "requestId"
    And the response has the following values
      | path        | value | condition |
      | totalItems  | 1     | >=        |
      | generatedAt |       | exists    |

  Scenario: The reports service needs its API key
    Given I use the "reports" service
    When I send a GET request to "/summary"
    Then the response status is 401
