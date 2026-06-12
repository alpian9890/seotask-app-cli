"use strict";

class CliError extends Error {}

class UsageError extends CliError {}

module.exports = { CliError, UsageError };