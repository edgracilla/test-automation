import { Given } from '@cucumber/cucumber';

// Profiles are defined under "auth" in the test config. Credentials are reused across
// scenarios until they expire; "force" signs in again.

async function authenticate(profile) {
  await this.authenticate(profile);
}

async function forceAuthenticate(profile) {
  await this.authenticate(profile, { fresh: true });
}

Given('I am authenticated as {string}', authenticate);
Given('I am logged in as {string}', authenticate);

Given('I force log in as {string}', forceAuthenticate);
Given('I am freshly authenticated as {string}', forceAuthenticate);

Given('I am not authenticated', function () {
  this.logout();
});

Given('I log out', function () {
  this.logout();
});
