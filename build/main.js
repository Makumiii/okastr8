#!/usr/bin/env bun
// @bun
import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// node_modules/commander/lib/error.js
var require_error = __commonJS((exports) => {
  class CommanderError extends Error {
    constructor(exitCode, code, message) {
      super(message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
      this.code = code;
      this.exitCode = exitCode;
      this.nestedError = undefined;
    }
  }

  class InvalidArgumentError extends CommanderError {
    constructor(message) {
      super(1, "commander.invalidArgument", message);
      Error.captureStackTrace(this, this.constructor);
      this.name = this.constructor.name;
    }
  }
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
});

// node_modules/commander/lib/argument.js
var require_argument = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Argument {
    constructor(name, description) {
      this.description = description || "";
      this.variadic = false;
      this.parseArg = undefined;
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.argChoices = undefined;
      switch (name[0]) {
        case "<":
          this.required = true;
          this._name = name.slice(1, -1);
          break;
        case "[":
          this.required = false;
          this._name = name.slice(1, -1);
          break;
        default:
          this.required = true;
          this._name = name;
          break;
      }
      if (this._name.length > 3 && this._name.slice(-3) === "...") {
        this.variadic = true;
        this._name = this._name.slice(0, -3);
      }
    }
    name() {
      return this._name;
    }
    _concatValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      return previous.concat(value);
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._concatValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    argRequired() {
      this.required = true;
      return this;
    }
    argOptional() {
      this.required = false;
      return this;
    }
  }
  function humanReadableArgName(arg) {
    const nameOutput = arg.name() + (arg.variadic === true ? "..." : "");
    return arg.required ? "<" + nameOutput + ">" : "[" + nameOutput + "]";
  }
  exports.Argument = Argument;
  exports.humanReadableArgName = humanReadableArgName;
});

// node_modules/commander/lib/help.js
var require_help = __commonJS((exports) => {
  var { humanReadableArgName } = require_argument();

  class Help {
    constructor() {
      this.helpWidth = undefined;
      this.minWidthToWrap = 40;
      this.sortSubcommands = false;
      this.sortOptions = false;
      this.showGlobalOptions = false;
    }
    prepareContext(contextOptions) {
      this.helpWidth = this.helpWidth ?? contextOptions.helpWidth ?? 80;
    }
    visibleCommands(cmd) {
      const visibleCommands = cmd.commands.filter((cmd2) => !cmd2._hidden);
      const helpCommand = cmd._getHelpCommand();
      if (helpCommand && !helpCommand._hidden) {
        visibleCommands.push(helpCommand);
      }
      if (this.sortSubcommands) {
        visibleCommands.sort((a, b) => {
          return a.name().localeCompare(b.name());
        });
      }
      return visibleCommands;
    }
    compareOptions(a, b) {
      const getSortKey = (option) => {
        return option.short ? option.short.replace(/^-/, "") : option.long.replace(/^--/, "");
      };
      return getSortKey(a).localeCompare(getSortKey(b));
    }
    visibleOptions(cmd) {
      const visibleOptions = cmd.options.filter((option) => !option.hidden);
      const helpOption = cmd._getHelpOption();
      if (helpOption && !helpOption.hidden) {
        const removeShort = helpOption.short && cmd._findOption(helpOption.short);
        const removeLong = helpOption.long && cmd._findOption(helpOption.long);
        if (!removeShort && !removeLong) {
          visibleOptions.push(helpOption);
        } else if (helpOption.long && !removeLong) {
          visibleOptions.push(cmd.createOption(helpOption.long, helpOption.description));
        } else if (helpOption.short && !removeShort) {
          visibleOptions.push(cmd.createOption(helpOption.short, helpOption.description));
        }
      }
      if (this.sortOptions) {
        visibleOptions.sort(this.compareOptions);
      }
      return visibleOptions;
    }
    visibleGlobalOptions(cmd) {
      if (!this.showGlobalOptions)
        return [];
      const globalOptions = [];
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        const visibleOptions = ancestorCmd.options.filter((option) => !option.hidden);
        globalOptions.push(...visibleOptions);
      }
      if (this.sortOptions) {
        globalOptions.sort(this.compareOptions);
      }
      return globalOptions;
    }
    visibleArguments(cmd) {
      if (cmd._argsDescription) {
        cmd.registeredArguments.forEach((argument) => {
          argument.description = argument.description || cmd._argsDescription[argument.name()] || "";
        });
      }
      if (cmd.registeredArguments.find((argument) => argument.description)) {
        return cmd.registeredArguments;
      }
      return [];
    }
    subcommandTerm(cmd) {
      const args = cmd.registeredArguments.map((arg) => humanReadableArgName(arg)).join(" ");
      return cmd._name + (cmd._aliases[0] ? "|" + cmd._aliases[0] : "") + (cmd.options.length ? " [options]" : "") + (args ? " " + args : "");
    }
    optionTerm(option) {
      return option.flags;
    }
    argumentTerm(argument) {
      return argument.name();
    }
    longestSubcommandTermLength(cmd, helper) {
      return helper.visibleCommands(cmd).reduce((max, command) => {
        return Math.max(max, this.displayWidth(helper.styleSubcommandTerm(helper.subcommandTerm(command))));
      }, 0);
    }
    longestOptionTermLength(cmd, helper) {
      return helper.visibleOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestGlobalOptionTermLength(cmd, helper) {
      return helper.visibleGlobalOptions(cmd).reduce((max, option) => {
        return Math.max(max, this.displayWidth(helper.styleOptionTerm(helper.optionTerm(option))));
      }, 0);
    }
    longestArgumentTermLength(cmd, helper) {
      return helper.visibleArguments(cmd).reduce((max, argument) => {
        return Math.max(max, this.displayWidth(helper.styleArgumentTerm(helper.argumentTerm(argument))));
      }, 0);
    }
    commandUsage(cmd) {
      let cmdName = cmd._name;
      if (cmd._aliases[0]) {
        cmdName = cmdName + "|" + cmd._aliases[0];
      }
      let ancestorCmdNames = "";
      for (let ancestorCmd = cmd.parent;ancestorCmd; ancestorCmd = ancestorCmd.parent) {
        ancestorCmdNames = ancestorCmd.name() + " " + ancestorCmdNames;
      }
      return ancestorCmdNames + cmdName + " " + cmd.usage();
    }
    commandDescription(cmd) {
      return cmd.description();
    }
    subcommandDescription(cmd) {
      return cmd.summary() || cmd.description();
    }
    optionDescription(option) {
      const extraInfo = [];
      if (option.argChoices) {
        extraInfo.push(`choices: ${option.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (option.defaultValue !== undefined) {
        const showDefault = option.required || option.optional || option.isBoolean() && typeof option.defaultValue === "boolean";
        if (showDefault) {
          extraInfo.push(`default: ${option.defaultValueDescription || JSON.stringify(option.defaultValue)}`);
        }
      }
      if (option.presetArg !== undefined && option.optional) {
        extraInfo.push(`preset: ${JSON.stringify(option.presetArg)}`);
      }
      if (option.envVar !== undefined) {
        extraInfo.push(`env: ${option.envVar}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (option.description) {
          return `${option.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return option.description;
    }
    argumentDescription(argument) {
      const extraInfo = [];
      if (argument.argChoices) {
        extraInfo.push(`choices: ${argument.argChoices.map((choice) => JSON.stringify(choice)).join(", ")}`);
      }
      if (argument.defaultValue !== undefined) {
        extraInfo.push(`default: ${argument.defaultValueDescription || JSON.stringify(argument.defaultValue)}`);
      }
      if (extraInfo.length > 0) {
        const extraDescription = `(${extraInfo.join(", ")})`;
        if (argument.description) {
          return `${argument.description} ${extraDescription}`;
        }
        return extraDescription;
      }
      return argument.description;
    }
    formatItemList(heading, items, helper) {
      if (items.length === 0)
        return [];
      return [helper.styleTitle(heading), ...items, ""];
    }
    groupItems(unsortedItems, visibleItems, getGroup) {
      const result = new Map;
      unsortedItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group))
          result.set(group, []);
      });
      visibleItems.forEach((item) => {
        const group = getGroup(item);
        if (!result.has(group)) {
          result.set(group, []);
        }
        result.get(group).push(item);
      });
      return result;
    }
    formatHelp(cmd, helper) {
      const termWidth = helper.padWidth(cmd, helper);
      const helpWidth = helper.helpWidth ?? 80;
      function callFormatItem(term, description) {
        return helper.formatItem(term, termWidth, description, helper);
      }
      let output = [
        `${helper.styleTitle("Usage:")} ${helper.styleUsage(helper.commandUsage(cmd))}`,
        ""
      ];
      const commandDescription = helper.commandDescription(cmd);
      if (commandDescription.length > 0) {
        output = output.concat([
          helper.boxWrap(helper.styleCommandDescription(commandDescription), helpWidth),
          ""
        ]);
      }
      const argumentList = helper.visibleArguments(cmd).map((argument) => {
        return callFormatItem(helper.styleArgumentTerm(helper.argumentTerm(argument)), helper.styleArgumentDescription(helper.argumentDescription(argument)));
      });
      output = output.concat(this.formatItemList("Arguments:", argumentList, helper));
      const optionGroups = this.groupItems(cmd.options, helper.visibleOptions(cmd), (option) => option.helpGroupHeading ?? "Options:");
      optionGroups.forEach((options, group) => {
        const optionList = options.map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList(group, optionList, helper));
      });
      if (helper.showGlobalOptions) {
        const globalOptionList = helper.visibleGlobalOptions(cmd).map((option) => {
          return callFormatItem(helper.styleOptionTerm(helper.optionTerm(option)), helper.styleOptionDescription(helper.optionDescription(option)));
        });
        output = output.concat(this.formatItemList("Global Options:", globalOptionList, helper));
      }
      const commandGroups = this.groupItems(cmd.commands, helper.visibleCommands(cmd), (sub) => sub.helpGroup() || "Commands:");
      commandGroups.forEach((commands, group) => {
        const commandList = commands.map((sub) => {
          return callFormatItem(helper.styleSubcommandTerm(helper.subcommandTerm(sub)), helper.styleSubcommandDescription(helper.subcommandDescription(sub)));
        });
        output = output.concat(this.formatItemList(group, commandList, helper));
      });
      return output.join(`
`);
    }
    displayWidth(str) {
      return stripColor(str).length;
    }
    styleTitle(str) {
      return str;
    }
    styleUsage(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word === "[command]")
          return this.styleSubcommandText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleCommandText(word);
      }).join(" ");
    }
    styleCommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleOptionDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleSubcommandDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleArgumentDescription(str) {
      return this.styleDescriptionText(str);
    }
    styleDescriptionText(str) {
      return str;
    }
    styleOptionTerm(str) {
      return this.styleOptionText(str);
    }
    styleSubcommandTerm(str) {
      return str.split(" ").map((word) => {
        if (word === "[options]")
          return this.styleOptionText(word);
        if (word[0] === "[" || word[0] === "<")
          return this.styleArgumentText(word);
        return this.styleSubcommandText(word);
      }).join(" ");
    }
    styleArgumentTerm(str) {
      return this.styleArgumentText(str);
    }
    styleOptionText(str) {
      return str;
    }
    styleArgumentText(str) {
      return str;
    }
    styleSubcommandText(str) {
      return str;
    }
    styleCommandText(str) {
      return str;
    }
    padWidth(cmd, helper) {
      return Math.max(helper.longestOptionTermLength(cmd, helper), helper.longestGlobalOptionTermLength(cmd, helper), helper.longestSubcommandTermLength(cmd, helper), helper.longestArgumentTermLength(cmd, helper));
    }
    preformatted(str) {
      return /\n[^\S\r\n]/.test(str);
    }
    formatItem(term, termWidth, description, helper) {
      const itemIndent = 2;
      const itemIndentStr = " ".repeat(itemIndent);
      if (!description)
        return itemIndentStr + term;
      const paddedTerm = term.padEnd(termWidth + term.length - helper.displayWidth(term));
      const spacerWidth = 2;
      const helpWidth = this.helpWidth ?? 80;
      const remainingWidth = helpWidth - termWidth - spacerWidth - itemIndent;
      let formattedDescription;
      if (remainingWidth < this.minWidthToWrap || helper.preformatted(description)) {
        formattedDescription = description;
      } else {
        const wrappedDescription = helper.boxWrap(description, remainingWidth);
        formattedDescription = wrappedDescription.replace(/\n/g, `
` + " ".repeat(termWidth + spacerWidth));
      }
      return itemIndentStr + paddedTerm + " ".repeat(spacerWidth) + formattedDescription.replace(/\n/g, `
${itemIndentStr}`);
    }
    boxWrap(str, width) {
      if (width < this.minWidthToWrap)
        return str;
      const rawLines = str.split(/\r\n|\n/);
      const chunkPattern = /[\s]*[^\s]+/g;
      const wrappedLines = [];
      rawLines.forEach((line) => {
        const chunks = line.match(chunkPattern);
        if (chunks === null) {
          wrappedLines.push("");
          return;
        }
        let sumChunks = [chunks.shift()];
        let sumWidth = this.displayWidth(sumChunks[0]);
        chunks.forEach((chunk) => {
          const visibleWidth = this.displayWidth(chunk);
          if (sumWidth + visibleWidth <= width) {
            sumChunks.push(chunk);
            sumWidth += visibleWidth;
            return;
          }
          wrappedLines.push(sumChunks.join(""));
          const nextChunk = chunk.trimStart();
          sumChunks = [nextChunk];
          sumWidth = this.displayWidth(nextChunk);
        });
        wrappedLines.push(sumChunks.join(""));
      });
      return wrappedLines.join(`
`);
    }
  }
  function stripColor(str) {
    const sgrPattern = /\x1b\[\d*(;\d*)*m/g;
    return str.replace(sgrPattern, "");
  }
  exports.Help = Help;
  exports.stripColor = stripColor;
});

// node_modules/commander/lib/option.js
var require_option = __commonJS((exports) => {
  var { InvalidArgumentError } = require_error();

  class Option {
    constructor(flags, description) {
      this.flags = flags;
      this.description = description || "";
      this.required = flags.includes("<");
      this.optional = flags.includes("[");
      this.variadic = /\w\.\.\.[>\]]$/.test(flags);
      this.mandatory = false;
      const optionFlags = splitOptionFlags(flags);
      this.short = optionFlags.shortFlag;
      this.long = optionFlags.longFlag;
      this.negate = false;
      if (this.long) {
        this.negate = this.long.startsWith("--no-");
      }
      this.defaultValue = undefined;
      this.defaultValueDescription = undefined;
      this.presetArg = undefined;
      this.envVar = undefined;
      this.parseArg = undefined;
      this.hidden = false;
      this.argChoices = undefined;
      this.conflictsWith = [];
      this.implied = undefined;
      this.helpGroupHeading = undefined;
    }
    default(value, description) {
      this.defaultValue = value;
      this.defaultValueDescription = description;
      return this;
    }
    preset(arg) {
      this.presetArg = arg;
      return this;
    }
    conflicts(names) {
      this.conflictsWith = this.conflictsWith.concat(names);
      return this;
    }
    implies(impliedOptionValues) {
      let newImplied = impliedOptionValues;
      if (typeof impliedOptionValues === "string") {
        newImplied = { [impliedOptionValues]: true };
      }
      this.implied = Object.assign(this.implied || {}, newImplied);
      return this;
    }
    env(name) {
      this.envVar = name;
      return this;
    }
    argParser(fn) {
      this.parseArg = fn;
      return this;
    }
    makeOptionMandatory(mandatory = true) {
      this.mandatory = !!mandatory;
      return this;
    }
    hideHelp(hide = true) {
      this.hidden = !!hide;
      return this;
    }
    _concatValue(value, previous) {
      if (previous === this.defaultValue || !Array.isArray(previous)) {
        return [value];
      }
      return previous.concat(value);
    }
    choices(values) {
      this.argChoices = values.slice();
      this.parseArg = (arg, previous) => {
        if (!this.argChoices.includes(arg)) {
          throw new InvalidArgumentError(`Allowed choices are ${this.argChoices.join(", ")}.`);
        }
        if (this.variadic) {
          return this._concatValue(arg, previous);
        }
        return arg;
      };
      return this;
    }
    name() {
      if (this.long) {
        return this.long.replace(/^--/, "");
      }
      return this.short.replace(/^-/, "");
    }
    attributeName() {
      if (this.negate) {
        return camelcase(this.name().replace(/^no-/, ""));
      }
      return camelcase(this.name());
    }
    helpGroup(heading) {
      this.helpGroupHeading = heading;
      return this;
    }
    is(arg) {
      return this.short === arg || this.long === arg;
    }
    isBoolean() {
      return !this.required && !this.optional && !this.negate;
    }
  }

  class DualOptions {
    constructor(options) {
      this.positiveOptions = new Map;
      this.negativeOptions = new Map;
      this.dualOptions = new Set;
      options.forEach((option) => {
        if (option.negate) {
          this.negativeOptions.set(option.attributeName(), option);
        } else {
          this.positiveOptions.set(option.attributeName(), option);
        }
      });
      this.negativeOptions.forEach((value, key) => {
        if (this.positiveOptions.has(key)) {
          this.dualOptions.add(key);
        }
      });
    }
    valueFromOption(value, option) {
      const optionKey = option.attributeName();
      if (!this.dualOptions.has(optionKey))
        return true;
      const preset = this.negativeOptions.get(optionKey).presetArg;
      const negativeValue = preset !== undefined ? preset : false;
      return option.negate === (negativeValue === value);
    }
  }
  function camelcase(str) {
    return str.split("-").reduce((str2, word) => {
      return str2 + word[0].toUpperCase() + word.slice(1);
    });
  }
  function splitOptionFlags(flags) {
    let shortFlag;
    let longFlag;
    const shortFlagExp = /^-[^-]$/;
    const longFlagExp = /^--[^-]/;
    const flagParts = flags.split(/[ |,]+/).concat("guard");
    if (shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (longFlagExp.test(flagParts[0]))
      longFlag = flagParts.shift();
    if (!shortFlag && shortFlagExp.test(flagParts[0]))
      shortFlag = flagParts.shift();
    if (!shortFlag && longFlagExp.test(flagParts[0])) {
      shortFlag = longFlag;
      longFlag = flagParts.shift();
    }
    if (flagParts[0].startsWith("-")) {
      const unsupportedFlag = flagParts[0];
      const baseError = `option creation failed due to '${unsupportedFlag}' in option flags '${flags}'`;
      if (/^-[^-][^-]/.test(unsupportedFlag))
        throw new Error(`${baseError}
- a short flag is a single dash and a single character
  - either use a single dash and a single character (for a short flag)
  - or use a double dash for a long option (and can have two, like '--ws, --workspace')`);
      if (shortFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many short flags`);
      if (longFlagExp.test(unsupportedFlag))
        throw new Error(`${baseError}
- too many long flags`);
      throw new Error(`${baseError}
- unrecognised flag format`);
    }
    if (shortFlag === undefined && longFlag === undefined)
      throw new Error(`option creation failed due to no flags found in '${flags}'.`);
    return { shortFlag, longFlag };
  }
  exports.Option = Option;
  exports.DualOptions = DualOptions;
});

// node_modules/commander/lib/suggestSimilar.js
var require_suggestSimilar = __commonJS((exports) => {
  var maxDistance = 3;
  function editDistance(a, b) {
    if (Math.abs(a.length - b.length) > maxDistance)
      return Math.max(a.length, b.length);
    const d = [];
    for (let i = 0;i <= a.length; i++) {
      d[i] = [i];
    }
    for (let j = 0;j <= b.length; j++) {
      d[0][j] = j;
    }
    for (let j = 1;j <= b.length; j++) {
      for (let i = 1;i <= a.length; i++) {
        let cost = 1;
        if (a[i - 1] === b[j - 1]) {
          cost = 0;
        } else {
          cost = 1;
        }
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
      }
    }
    return d[a.length][b.length];
  }
  function suggestSimilar(word, candidates) {
    if (!candidates || candidates.length === 0)
      return "";
    candidates = Array.from(new Set(candidates));
    const searchingOptions = word.startsWith("--");
    if (searchingOptions) {
      word = word.slice(2);
      candidates = candidates.map((candidate) => candidate.slice(2));
    }
    let similar = [];
    let bestDistance = maxDistance;
    const minSimilarity = 0.4;
    candidates.forEach((candidate) => {
      if (candidate.length <= 1)
        return;
      const distance = editDistance(word, candidate);
      const length = Math.max(word.length, candidate.length);
      const similarity = (length - distance) / length;
      if (similarity > minSimilarity) {
        if (distance < bestDistance) {
          bestDistance = distance;
          similar = [candidate];
        } else if (distance === bestDistance) {
          similar.push(candidate);
        }
      }
    });
    similar.sort((a, b) => a.localeCompare(b));
    if (searchingOptions) {
      similar = similar.map((candidate) => `--${candidate}`);
    }
    if (similar.length > 1) {
      return `
(Did you mean one of ${similar.join(", ")}?)`;
    }
    if (similar.length === 1) {
      return `
(Did you mean ${similar[0]}?)`;
    }
    return "";
  }
  exports.suggestSimilar = suggestSimilar;
});

// node_modules/commander/lib/command.js
var require_command = __commonJS((exports) => {
  var EventEmitter = __require("node:events").EventEmitter;
  var childProcess = __require("node:child_process");
  var path = __require("node:path");
  var fs = __require("node:fs");
  var process2 = __require("node:process");
  var { Argument, humanReadableArgName } = require_argument();
  var { CommanderError } = require_error();
  var { Help, stripColor } = require_help();
  var { Option, DualOptions } = require_option();
  var { suggestSimilar } = require_suggestSimilar();

  class Command extends EventEmitter {
    constructor(name) {
      super();
      this.commands = [];
      this.options = [];
      this.parent = null;
      this._allowUnknownOption = false;
      this._allowExcessArguments = false;
      this.registeredArguments = [];
      this._args = this.registeredArguments;
      this.args = [];
      this.rawArgs = [];
      this.processedArgs = [];
      this._scriptPath = null;
      this._name = name || "";
      this._optionValues = {};
      this._optionValueSources = {};
      this._storeOptionsAsProperties = false;
      this._actionHandler = null;
      this._executableHandler = false;
      this._executableFile = null;
      this._executableDir = null;
      this._defaultCommandName = null;
      this._exitCallback = null;
      this._aliases = [];
      this._combineFlagAndOptionalValue = true;
      this._description = "";
      this._summary = "";
      this._argsDescription = undefined;
      this._enablePositionalOptions = false;
      this._passThroughOptions = false;
      this._lifeCycleHooks = {};
      this._showHelpAfterError = false;
      this._showSuggestionAfterError = true;
      this._savedState = null;
      this._outputConfiguration = {
        writeOut: (str) => process2.stdout.write(str),
        writeErr: (str) => process2.stderr.write(str),
        outputError: (str, write) => write(str),
        getOutHelpWidth: () => process2.stdout.isTTY ? process2.stdout.columns : undefined,
        getErrHelpWidth: () => process2.stderr.isTTY ? process2.stderr.columns : undefined,
        getOutHasColors: () => useColor() ?? (process2.stdout.isTTY && process2.stdout.hasColors?.()),
        getErrHasColors: () => useColor() ?? (process2.stderr.isTTY && process2.stderr.hasColors?.()),
        stripColor: (str) => stripColor(str)
      };
      this._hidden = false;
      this._helpOption = undefined;
      this._addImplicitHelpCommand = undefined;
      this._helpCommand = undefined;
      this._helpConfiguration = {};
      this._helpGroupHeading = undefined;
      this._defaultCommandGroup = undefined;
      this._defaultOptionGroup = undefined;
    }
    copyInheritedSettings(sourceCommand) {
      this._outputConfiguration = sourceCommand._outputConfiguration;
      this._helpOption = sourceCommand._helpOption;
      this._helpCommand = sourceCommand._helpCommand;
      this._helpConfiguration = sourceCommand._helpConfiguration;
      this._exitCallback = sourceCommand._exitCallback;
      this._storeOptionsAsProperties = sourceCommand._storeOptionsAsProperties;
      this._combineFlagAndOptionalValue = sourceCommand._combineFlagAndOptionalValue;
      this._allowExcessArguments = sourceCommand._allowExcessArguments;
      this._enablePositionalOptions = sourceCommand._enablePositionalOptions;
      this._showHelpAfterError = sourceCommand._showHelpAfterError;
      this._showSuggestionAfterError = sourceCommand._showSuggestionAfterError;
      return this;
    }
    _getCommandAndAncestors() {
      const result = [];
      for (let command = this;command; command = command.parent) {
        result.push(command);
      }
      return result;
    }
    command(nameAndArgs, actionOptsOrExecDesc, execOpts) {
      let desc = actionOptsOrExecDesc;
      let opts = execOpts;
      if (typeof desc === "object" && desc !== null) {
        opts = desc;
        desc = null;
      }
      opts = opts || {};
      const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const cmd = this.createCommand(name);
      if (desc) {
        cmd.description(desc);
        cmd._executableHandler = true;
      }
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      cmd._hidden = !!(opts.noHelp || opts.hidden);
      cmd._executableFile = opts.executableFile || null;
      if (args)
        cmd.arguments(args);
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd.copyInheritedSettings(this);
      if (desc)
        return this;
      return cmd;
    }
    createCommand(name) {
      return new Command(name);
    }
    createHelp() {
      return Object.assign(new Help, this.configureHelp());
    }
    configureHelp(configuration) {
      if (configuration === undefined)
        return this._helpConfiguration;
      this._helpConfiguration = configuration;
      return this;
    }
    configureOutput(configuration) {
      if (configuration === undefined)
        return this._outputConfiguration;
      this._outputConfiguration = Object.assign({}, this._outputConfiguration, configuration);
      return this;
    }
    showHelpAfterError(displayHelp = true) {
      if (typeof displayHelp !== "string")
        displayHelp = !!displayHelp;
      this._showHelpAfterError = displayHelp;
      return this;
    }
    showSuggestionAfterError(displaySuggestion = true) {
      this._showSuggestionAfterError = !!displaySuggestion;
      return this;
    }
    addCommand(cmd, opts) {
      if (!cmd._name) {
        throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);
      }
      opts = opts || {};
      if (opts.isDefault)
        this._defaultCommandName = cmd._name;
      if (opts.noHelp || opts.hidden)
        cmd._hidden = true;
      this._registerCommand(cmd);
      cmd.parent = this;
      cmd._checkForBrokenPassThrough();
      return this;
    }
    createArgument(name, description) {
      return new Argument(name, description);
    }
    argument(name, description, parseArg, defaultValue) {
      const argument = this.createArgument(name, description);
      if (typeof parseArg === "function") {
        argument.default(defaultValue).argParser(parseArg);
      } else {
        argument.default(parseArg);
      }
      this.addArgument(argument);
      return this;
    }
    arguments(names) {
      names.trim().split(/ +/).forEach((detail) => {
        this.argument(detail);
      });
      return this;
    }
    addArgument(argument) {
      const previousArgument = this.registeredArguments.slice(-1)[0];
      if (previousArgument && previousArgument.variadic) {
        throw new Error(`only the last argument can be variadic '${previousArgument.name()}'`);
      }
      if (argument.required && argument.defaultValue !== undefined && argument.parseArg === undefined) {
        throw new Error(`a default value for a required argument is never used: '${argument.name()}'`);
      }
      this.registeredArguments.push(argument);
      return this;
    }
    helpCommand(enableOrNameAndArgs, description) {
      if (typeof enableOrNameAndArgs === "boolean") {
        this._addImplicitHelpCommand = enableOrNameAndArgs;
        if (enableOrNameAndArgs && this._defaultCommandGroup) {
          this._initCommandGroup(this._getHelpCommand());
        }
        return this;
      }
      const nameAndArgs = enableOrNameAndArgs ?? "help [command]";
      const [, helpName, helpArgs] = nameAndArgs.match(/([^ ]+) *(.*)/);
      const helpDescription = description ?? "display help for command";
      const helpCommand = this.createCommand(helpName);
      helpCommand.helpOption(false);
      if (helpArgs)
        helpCommand.arguments(helpArgs);
      if (helpDescription)
        helpCommand.description(helpDescription);
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      if (enableOrNameAndArgs || description)
        this._initCommandGroup(helpCommand);
      return this;
    }
    addHelpCommand(helpCommand, deprecatedDescription) {
      if (typeof helpCommand !== "object") {
        this.helpCommand(helpCommand, deprecatedDescription);
        return this;
      }
      this._addImplicitHelpCommand = true;
      this._helpCommand = helpCommand;
      this._initCommandGroup(helpCommand);
      return this;
    }
    _getHelpCommand() {
      const hasImplicitHelpCommand = this._addImplicitHelpCommand ?? (this.commands.length && !this._actionHandler && !this._findCommand("help"));
      if (hasImplicitHelpCommand) {
        if (this._helpCommand === undefined) {
          this.helpCommand(undefined, undefined);
        }
        return this._helpCommand;
      }
      return null;
    }
    hook(event, listener) {
      const allowedValues = ["preSubcommand", "preAction", "postAction"];
      if (!allowedValues.includes(event)) {
        throw new Error(`Unexpected value for event passed to hook : '${event}'.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      if (this._lifeCycleHooks[event]) {
        this._lifeCycleHooks[event].push(listener);
      } else {
        this._lifeCycleHooks[event] = [listener];
      }
      return this;
    }
    exitOverride(fn) {
      if (fn) {
        this._exitCallback = fn;
      } else {
        this._exitCallback = (err) => {
          if (err.code !== "commander.executeSubCommandAsync") {
            throw err;
          } else {}
        };
      }
      return this;
    }
    _exit(exitCode, code, message) {
      if (this._exitCallback) {
        this._exitCallback(new CommanderError(exitCode, code, message));
      }
      process2.exit(exitCode);
    }
    action(fn) {
      const listener = (args) => {
        const expectedArgsCount = this.registeredArguments.length;
        const actionArgs = args.slice(0, expectedArgsCount);
        if (this._storeOptionsAsProperties) {
          actionArgs[expectedArgsCount] = this;
        } else {
          actionArgs[expectedArgsCount] = this.opts();
        }
        actionArgs.push(this);
        return fn.apply(this, actionArgs);
      };
      this._actionHandler = listener;
      return this;
    }
    createOption(flags, description) {
      return new Option(flags, description);
    }
    _callParseArg(target, value, previous, invalidArgumentMessage) {
      try {
        return target.parseArg(value, previous);
      } catch (err) {
        if (err.code === "commander.invalidArgument") {
          const message = `${invalidArgumentMessage} ${err.message}`;
          this.error(message, { exitCode: err.exitCode, code: err.code });
        }
        throw err;
      }
    }
    _registerOption(option) {
      const matchingOption = option.short && this._findOption(option.short) || option.long && this._findOption(option.long);
      if (matchingOption) {
        const matchingFlag = option.long && this._findOption(option.long) ? option.long : option.short;
        throw new Error(`Cannot add option '${option.flags}'${this._name && ` to command '${this._name}'`} due to conflicting flag '${matchingFlag}'
-  already used by option '${matchingOption.flags}'`);
      }
      this._initOptionGroup(option);
      this.options.push(option);
    }
    _registerCommand(command) {
      const knownBy = (cmd) => {
        return [cmd.name()].concat(cmd.aliases());
      };
      const alreadyUsed = knownBy(command).find((name) => this._findCommand(name));
      if (alreadyUsed) {
        const existingCmd = knownBy(this._findCommand(alreadyUsed)).join("|");
        const newCmd = knownBy(command).join("|");
        throw new Error(`cannot add command '${newCmd}' as already have command '${existingCmd}'`);
      }
      this._initCommandGroup(command);
      this.commands.push(command);
    }
    addOption(option) {
      this._registerOption(option);
      const oname = option.name();
      const name = option.attributeName();
      if (option.negate) {
        const positiveLongFlag = option.long.replace(/^--no-/, "--");
        if (!this._findOption(positiveLongFlag)) {
          this.setOptionValueWithSource(name, option.defaultValue === undefined ? true : option.defaultValue, "default");
        }
      } else if (option.defaultValue !== undefined) {
        this.setOptionValueWithSource(name, option.defaultValue, "default");
      }
      const handleOptionValue = (val, invalidValueMessage, valueSource) => {
        if (val == null && option.presetArg !== undefined) {
          val = option.presetArg;
        }
        const oldValue = this.getOptionValue(name);
        if (val !== null && option.parseArg) {
          val = this._callParseArg(option, val, oldValue, invalidValueMessage);
        } else if (val !== null && option.variadic) {
          val = option._concatValue(val, oldValue);
        }
        if (val == null) {
          if (option.negate) {
            val = false;
          } else if (option.isBoolean() || option.optional) {
            val = true;
          } else {
            val = "";
          }
        }
        this.setOptionValueWithSource(name, val, valueSource);
      };
      this.on("option:" + oname, (val) => {
        const invalidValueMessage = `error: option '${option.flags}' argument '${val}' is invalid.`;
        handleOptionValue(val, invalidValueMessage, "cli");
      });
      if (option.envVar) {
        this.on("optionEnv:" + oname, (val) => {
          const invalidValueMessage = `error: option '${option.flags}' value '${val}' from env '${option.envVar}' is invalid.`;
          handleOptionValue(val, invalidValueMessage, "env");
        });
      }
      return this;
    }
    _optionEx(config, flags, description, fn, defaultValue) {
      if (typeof flags === "object" && flags instanceof Option) {
        throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
      }
      const option = this.createOption(flags, description);
      option.makeOptionMandatory(!!config.mandatory);
      if (typeof fn === "function") {
        option.default(defaultValue).argParser(fn);
      } else if (fn instanceof RegExp) {
        const regex = fn;
        fn = (val, def) => {
          const m = regex.exec(val);
          return m ? m[0] : def;
        };
        option.default(defaultValue).argParser(fn);
      } else {
        option.default(fn);
      }
      return this.addOption(option);
    }
    option(flags, description, parseArg, defaultValue) {
      return this._optionEx({}, flags, description, parseArg, defaultValue);
    }
    requiredOption(flags, description, parseArg, defaultValue) {
      return this._optionEx({ mandatory: true }, flags, description, parseArg, defaultValue);
    }
    combineFlagAndOptionalValue(combine = true) {
      this._combineFlagAndOptionalValue = !!combine;
      return this;
    }
    allowUnknownOption(allowUnknown = true) {
      this._allowUnknownOption = !!allowUnknown;
      return this;
    }
    allowExcessArguments(allowExcess = true) {
      this._allowExcessArguments = !!allowExcess;
      return this;
    }
    enablePositionalOptions(positional = true) {
      this._enablePositionalOptions = !!positional;
      return this;
    }
    passThroughOptions(passThrough = true) {
      this._passThroughOptions = !!passThrough;
      this._checkForBrokenPassThrough();
      return this;
    }
    _checkForBrokenPassThrough() {
      if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
        throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
      }
    }
    storeOptionsAsProperties(storeAsProperties = true) {
      if (this.options.length) {
        throw new Error("call .storeOptionsAsProperties() before adding options");
      }
      if (Object.keys(this._optionValues).length) {
        throw new Error("call .storeOptionsAsProperties() before setting option values");
      }
      this._storeOptionsAsProperties = !!storeAsProperties;
      return this;
    }
    getOptionValue(key) {
      if (this._storeOptionsAsProperties) {
        return this[key];
      }
      return this._optionValues[key];
    }
    setOptionValue(key, value) {
      return this.setOptionValueWithSource(key, value, undefined);
    }
    setOptionValueWithSource(key, value, source) {
      if (this._storeOptionsAsProperties) {
        this[key] = value;
      } else {
        this._optionValues[key] = value;
      }
      this._optionValueSources[key] = source;
      return this;
    }
    getOptionValueSource(key) {
      return this._optionValueSources[key];
    }
    getOptionValueSourceWithGlobals(key) {
      let source;
      this._getCommandAndAncestors().forEach((cmd) => {
        if (cmd.getOptionValueSource(key) !== undefined) {
          source = cmd.getOptionValueSource(key);
        }
      });
      return source;
    }
    _prepareUserArgs(argv, parseOptions) {
      if (argv !== undefined && !Array.isArray(argv)) {
        throw new Error("first parameter to parse must be array or undefined");
      }
      parseOptions = parseOptions || {};
      if (argv === undefined && parseOptions.from === undefined) {
        if (process2.versions?.electron) {
          parseOptions.from = "electron";
        }
        const execArgv = process2.execArgv ?? [];
        if (execArgv.includes("-e") || execArgv.includes("--eval") || execArgv.includes("-p") || execArgv.includes("--print")) {
          parseOptions.from = "eval";
        }
      }
      if (argv === undefined) {
        argv = process2.argv;
      }
      this.rawArgs = argv.slice();
      let userArgs;
      switch (parseOptions.from) {
        case undefined:
        case "node":
          this._scriptPath = argv[1];
          userArgs = argv.slice(2);
          break;
        case "electron":
          if (process2.defaultApp) {
            this._scriptPath = argv[1];
            userArgs = argv.slice(2);
          } else {
            userArgs = argv.slice(1);
          }
          break;
        case "user":
          userArgs = argv.slice(0);
          break;
        case "eval":
          userArgs = argv.slice(1);
          break;
        default:
          throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
      }
      if (!this._name && this._scriptPath)
        this.nameFromFilename(this._scriptPath);
      this._name = this._name || "program";
      return userArgs;
    }
    parse(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      this._parseCommand([], userArgs);
      return this;
    }
    async parseAsync(argv, parseOptions) {
      this._prepareForParse();
      const userArgs = this._prepareUserArgs(argv, parseOptions);
      await this._parseCommand([], userArgs);
      return this;
    }
    _prepareForParse() {
      if (this._savedState === null) {
        this.saveStateBeforeParse();
      } else {
        this.restoreStateBeforeParse();
      }
    }
    saveStateBeforeParse() {
      this._savedState = {
        _name: this._name,
        _optionValues: { ...this._optionValues },
        _optionValueSources: { ...this._optionValueSources }
      };
    }
    restoreStateBeforeParse() {
      if (this._storeOptionsAsProperties)
        throw new Error(`Can not call parse again when storeOptionsAsProperties is true.
- either make a new Command for each call to parse, or stop storing options as properties`);
      this._name = this._savedState._name;
      this._scriptPath = null;
      this.rawArgs = [];
      this._optionValues = { ...this._savedState._optionValues };
      this._optionValueSources = { ...this._savedState._optionValueSources };
      this.args = [];
      this.processedArgs = [];
    }
    _checkForMissingExecutable(executableFile, executableDir, subcommandName) {
      if (fs.existsSync(executableFile))
        return;
      const executableDirMessage = executableDir ? `searched for local subcommand relative to directory '${executableDir}'` : "no directory for search for local subcommand, use .executableDir() to supply a custom directory";
      const executableMissing = `'${executableFile}' does not exist
 - if '${subcommandName}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${executableDirMessage}`;
      throw new Error(executableMissing);
    }
    _executeSubCommand(subcommand, args) {
      args = args.slice();
      let launchWithNode = false;
      const sourceExt = [".js", ".ts", ".tsx", ".mjs", ".cjs"];
      function findFile(baseDir, baseName) {
        const localBin = path.resolve(baseDir, baseName);
        if (fs.existsSync(localBin))
          return localBin;
        if (sourceExt.includes(path.extname(baseName)))
          return;
        const foundExt = sourceExt.find((ext) => fs.existsSync(`${localBin}${ext}`));
        if (foundExt)
          return `${localBin}${foundExt}`;
        return;
      }
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      let executableFile = subcommand._executableFile || `${this._name}-${subcommand._name}`;
      let executableDir = this._executableDir || "";
      if (this._scriptPath) {
        let resolvedScriptPath;
        try {
          resolvedScriptPath = fs.realpathSync(this._scriptPath);
        } catch {
          resolvedScriptPath = this._scriptPath;
        }
        executableDir = path.resolve(path.dirname(resolvedScriptPath), executableDir);
      }
      if (executableDir) {
        let localFile = findFile(executableDir, executableFile);
        if (!localFile && !subcommand._executableFile && this._scriptPath) {
          const legacyName = path.basename(this._scriptPath, path.extname(this._scriptPath));
          if (legacyName !== this._name) {
            localFile = findFile(executableDir, `${legacyName}-${subcommand._name}`);
          }
        }
        executableFile = localFile || executableFile;
      }
      launchWithNode = sourceExt.includes(path.extname(executableFile));
      let proc;
      if (process2.platform !== "win32") {
        if (launchWithNode) {
          args.unshift(executableFile);
          args = incrementNodeInspectorPort(process2.execArgv).concat(args);
          proc = childProcess.spawn(process2.argv[0], args, { stdio: "inherit" });
        } else {
          proc = childProcess.spawn(executableFile, args, { stdio: "inherit" });
        }
      } else {
        this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        args.unshift(executableFile);
        args = incrementNodeInspectorPort(process2.execArgv).concat(args);
        proc = childProcess.spawn(process2.execPath, args, { stdio: "inherit" });
      }
      if (!proc.killed) {
        const signals = ["SIGUSR1", "SIGUSR2", "SIGTERM", "SIGINT", "SIGHUP"];
        signals.forEach((signal) => {
          process2.on(signal, () => {
            if (proc.killed === false && proc.exitCode === null) {
              proc.kill(signal);
            }
          });
        });
      }
      const exitCallback = this._exitCallback;
      proc.on("close", (code) => {
        code = code ?? 1;
        if (!exitCallback) {
          process2.exit(code);
        } else {
          exitCallback(new CommanderError(code, "commander.executeSubCommandAsync", "(close)"));
        }
      });
      proc.on("error", (err) => {
        if (err.code === "ENOENT") {
          this._checkForMissingExecutable(executableFile, executableDir, subcommand._name);
        } else if (err.code === "EACCES") {
          throw new Error(`'${executableFile}' not executable`);
        }
        if (!exitCallback) {
          process2.exit(1);
        } else {
          const wrappedError = new CommanderError(1, "commander.executeSubCommandAsync", "(error)");
          wrappedError.nestedError = err;
          exitCallback(wrappedError);
        }
      });
      this.runningCommand = proc;
    }
    _dispatchSubcommand(commandName, operands, unknown) {
      const subCommand = this._findCommand(commandName);
      if (!subCommand)
        this.help({ error: true });
      subCommand._prepareForParse();
      let promiseChain;
      promiseChain = this._chainOrCallSubCommandHook(promiseChain, subCommand, "preSubcommand");
      promiseChain = this._chainOrCall(promiseChain, () => {
        if (subCommand._executableHandler) {
          this._executeSubCommand(subCommand, operands.concat(unknown));
        } else {
          return subCommand._parseCommand(operands, unknown);
        }
      });
      return promiseChain;
    }
    _dispatchHelpCommand(subcommandName) {
      if (!subcommandName) {
        this.help();
      }
      const subCommand = this._findCommand(subcommandName);
      if (subCommand && !subCommand._executableHandler) {
        subCommand.help();
      }
      return this._dispatchSubcommand(subcommandName, [], [this._getHelpOption()?.long ?? this._getHelpOption()?.short ?? "--help"]);
    }
    _checkNumberOfArguments() {
      this.registeredArguments.forEach((arg, i) => {
        if (arg.required && this.args[i] == null) {
          this.missingArgument(arg.name());
        }
      });
      if (this.registeredArguments.length > 0 && this.registeredArguments[this.registeredArguments.length - 1].variadic) {
        return;
      }
      if (this.args.length > this.registeredArguments.length) {
        this._excessArguments(this.args);
      }
    }
    _processArguments() {
      const myParseArg = (argument, value, previous) => {
        let parsedValue = value;
        if (value !== null && argument.parseArg) {
          const invalidValueMessage = `error: command-argument value '${value}' is invalid for argument '${argument.name()}'.`;
          parsedValue = this._callParseArg(argument, value, previous, invalidValueMessage);
        }
        return parsedValue;
      };
      this._checkNumberOfArguments();
      const processedArgs = [];
      this.registeredArguments.forEach((declaredArg, index) => {
        let value = declaredArg.defaultValue;
        if (declaredArg.variadic) {
          if (index < this.args.length) {
            value = this.args.slice(index);
            if (declaredArg.parseArg) {
              value = value.reduce((processed, v) => {
                return myParseArg(declaredArg, v, processed);
              }, declaredArg.defaultValue);
            }
          } else if (value === undefined) {
            value = [];
          }
        } else if (index < this.args.length) {
          value = this.args[index];
          if (declaredArg.parseArg) {
            value = myParseArg(declaredArg, value, declaredArg.defaultValue);
          }
        }
        processedArgs[index] = value;
      });
      this.processedArgs = processedArgs;
    }
    _chainOrCall(promise, fn) {
      if (promise && promise.then && typeof promise.then === "function") {
        return promise.then(() => fn());
      }
      return fn();
    }
    _chainOrCallHooks(promise, event) {
      let result = promise;
      const hooks = [];
      this._getCommandAndAncestors().reverse().filter((cmd) => cmd._lifeCycleHooks[event] !== undefined).forEach((hookedCommand) => {
        hookedCommand._lifeCycleHooks[event].forEach((callback) => {
          hooks.push({ hookedCommand, callback });
        });
      });
      if (event === "postAction") {
        hooks.reverse();
      }
      hooks.forEach((hookDetail) => {
        result = this._chainOrCall(result, () => {
          return hookDetail.callback(hookDetail.hookedCommand, this);
        });
      });
      return result;
    }
    _chainOrCallSubCommandHook(promise, subCommand, event) {
      let result = promise;
      if (this._lifeCycleHooks[event] !== undefined) {
        this._lifeCycleHooks[event].forEach((hook) => {
          result = this._chainOrCall(result, () => {
            return hook(this, subCommand);
          });
        });
      }
      return result;
    }
    _parseCommand(operands, unknown) {
      const parsed = this.parseOptions(unknown);
      this._parseOptionsEnv();
      this._parseOptionsImplied();
      operands = operands.concat(parsed.operands);
      unknown = parsed.unknown;
      this.args = operands.concat(unknown);
      if (operands && this._findCommand(operands[0])) {
        return this._dispatchSubcommand(operands[0], operands.slice(1), unknown);
      }
      if (this._getHelpCommand() && operands[0] === this._getHelpCommand().name()) {
        return this._dispatchHelpCommand(operands[1]);
      }
      if (this._defaultCommandName) {
        this._outputHelpIfRequested(unknown);
        return this._dispatchSubcommand(this._defaultCommandName, operands, unknown);
      }
      if (this.commands.length && this.args.length === 0 && !this._actionHandler && !this._defaultCommandName) {
        this.help({ error: true });
      }
      this._outputHelpIfRequested(parsed.unknown);
      this._checkForMissingMandatoryOptions();
      this._checkForConflictingOptions();
      const checkForUnknownOptions = () => {
        if (parsed.unknown.length > 0) {
          this.unknownOption(parsed.unknown[0]);
        }
      };
      const commandEvent = `command:${this.name()}`;
      if (this._actionHandler) {
        checkForUnknownOptions();
        this._processArguments();
        let promiseChain;
        promiseChain = this._chainOrCallHooks(promiseChain, "preAction");
        promiseChain = this._chainOrCall(promiseChain, () => this._actionHandler(this.processedArgs));
        if (this.parent) {
          promiseChain = this._chainOrCall(promiseChain, () => {
            this.parent.emit(commandEvent, operands, unknown);
          });
        }
        promiseChain = this._chainOrCallHooks(promiseChain, "postAction");
        return promiseChain;
      }
      if (this.parent && this.parent.listenerCount(commandEvent)) {
        checkForUnknownOptions();
        this._processArguments();
        this.parent.emit(commandEvent, operands, unknown);
      } else if (operands.length) {
        if (this._findCommand("*")) {
          return this._dispatchSubcommand("*", operands, unknown);
        }
        if (this.listenerCount("command:*")) {
          this.emit("command:*", operands, unknown);
        } else if (this.commands.length) {
          this.unknownCommand();
        } else {
          checkForUnknownOptions();
          this._processArguments();
        }
      } else if (this.commands.length) {
        checkForUnknownOptions();
        this.help({ error: true });
      } else {
        checkForUnknownOptions();
        this._processArguments();
      }
    }
    _findCommand(name) {
      if (!name)
        return;
      return this.commands.find((cmd) => cmd._name === name || cmd._aliases.includes(name));
    }
    _findOption(arg) {
      return this.options.find((option) => option.is(arg));
    }
    _checkForMissingMandatoryOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd.options.forEach((anOption) => {
          if (anOption.mandatory && cmd.getOptionValue(anOption.attributeName()) === undefined) {
            cmd.missingMandatoryOptionValue(anOption);
          }
        });
      });
    }
    _checkForConflictingLocalOptions() {
      const definedNonDefaultOptions = this.options.filter((option) => {
        const optionKey = option.attributeName();
        if (this.getOptionValue(optionKey) === undefined) {
          return false;
        }
        return this.getOptionValueSource(optionKey) !== "default";
      });
      const optionsWithConflicting = definedNonDefaultOptions.filter((option) => option.conflictsWith.length > 0);
      optionsWithConflicting.forEach((option) => {
        const conflictingAndDefined = definedNonDefaultOptions.find((defined) => option.conflictsWith.includes(defined.attributeName()));
        if (conflictingAndDefined) {
          this._conflictingOption(option, conflictingAndDefined);
        }
      });
    }
    _checkForConflictingOptions() {
      this._getCommandAndAncestors().forEach((cmd) => {
        cmd._checkForConflictingLocalOptions();
      });
    }
    parseOptions(argv) {
      const operands = [];
      const unknown = [];
      let dest = operands;
      const args = argv.slice();
      function maybeOption(arg) {
        return arg.length > 1 && arg[0] === "-";
      }
      const negativeNumberArg = (arg) => {
        if (!/^-\d*\.?\d+(e[+-]?\d+)?$/.test(arg))
          return false;
        return !this._getCommandAndAncestors().some((cmd) => cmd.options.map((opt) => opt.short).some((short) => /^-\d$/.test(short)));
      };
      let activeVariadicOption = null;
      while (args.length) {
        const arg = args.shift();
        if (arg === "--") {
          if (dest === unknown)
            dest.push(arg);
          dest.push(...args);
          break;
        }
        if (activeVariadicOption && (!maybeOption(arg) || negativeNumberArg(arg))) {
          this.emit(`option:${activeVariadicOption.name()}`, arg);
          continue;
        }
        activeVariadicOption = null;
        if (maybeOption(arg)) {
          const option = this._findOption(arg);
          if (option) {
            if (option.required) {
              const value = args.shift();
              if (value === undefined)
                this.optionMissingArgument(option);
              this.emit(`option:${option.name()}`, value);
            } else if (option.optional) {
              let value = null;
              if (args.length > 0 && (!maybeOption(args[0]) || negativeNumberArg(args[0]))) {
                value = args.shift();
              }
              this.emit(`option:${option.name()}`, value);
            } else {
              this.emit(`option:${option.name()}`);
            }
            activeVariadicOption = option.variadic ? option : null;
            continue;
          }
        }
        if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
          const option = this._findOption(`-${arg[1]}`);
          if (option) {
            if (option.required || option.optional && this._combineFlagAndOptionalValue) {
              this.emit(`option:${option.name()}`, arg.slice(2));
            } else {
              this.emit(`option:${option.name()}`);
              args.unshift(`-${arg.slice(2)}`);
            }
            continue;
          }
        }
        if (/^--[^=]+=/.test(arg)) {
          const index = arg.indexOf("=");
          const option = this._findOption(arg.slice(0, index));
          if (option && (option.required || option.optional)) {
            this.emit(`option:${option.name()}`, arg.slice(index + 1));
            continue;
          }
        }
        if (dest === operands && maybeOption(arg) && !(this.commands.length === 0 && negativeNumberArg(arg))) {
          dest = unknown;
        }
        if ((this._enablePositionalOptions || this._passThroughOptions) && operands.length === 0 && unknown.length === 0) {
          if (this._findCommand(arg)) {
            operands.push(arg);
            if (args.length > 0)
              unknown.push(...args);
            break;
          } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
            operands.push(arg);
            if (args.length > 0)
              operands.push(...args);
            break;
          } else if (this._defaultCommandName) {
            unknown.push(arg);
            if (args.length > 0)
              unknown.push(...args);
            break;
          }
        }
        if (this._passThroughOptions) {
          dest.push(arg);
          if (args.length > 0)
            dest.push(...args);
          break;
        }
        dest.push(arg);
      }
      return { operands, unknown };
    }
    opts() {
      if (this._storeOptionsAsProperties) {
        const result = {};
        const len = this.options.length;
        for (let i = 0;i < len; i++) {
          const key = this.options[i].attributeName();
          result[key] = key === this._versionOptionName ? this._version : this[key];
        }
        return result;
      }
      return this._optionValues;
    }
    optsWithGlobals() {
      return this._getCommandAndAncestors().reduce((combinedOptions, cmd) => Object.assign(combinedOptions, cmd.opts()), {});
    }
    error(message, errorOptions) {
      this._outputConfiguration.outputError(`${message}
`, this._outputConfiguration.writeErr);
      if (typeof this._showHelpAfterError === "string") {
        this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`);
      } else if (this._showHelpAfterError) {
        this._outputConfiguration.writeErr(`
`);
        this.outputHelp({ error: true });
      }
      const config = errorOptions || {};
      const exitCode = config.exitCode || 1;
      const code = config.code || "commander.error";
      this._exit(exitCode, code, message);
    }
    _parseOptionsEnv() {
      this.options.forEach((option) => {
        if (option.envVar && option.envVar in process2.env) {
          const optionKey = option.attributeName();
          if (this.getOptionValue(optionKey) === undefined || ["default", "config", "env"].includes(this.getOptionValueSource(optionKey))) {
            if (option.required || option.optional) {
              this.emit(`optionEnv:${option.name()}`, process2.env[option.envVar]);
            } else {
              this.emit(`optionEnv:${option.name()}`);
            }
          }
        }
      });
    }
    _parseOptionsImplied() {
      const dualHelper = new DualOptions(this.options);
      const hasCustomOptionValue = (optionKey) => {
        return this.getOptionValue(optionKey) !== undefined && !["default", "implied"].includes(this.getOptionValueSource(optionKey));
      };
      this.options.filter((option) => option.implied !== undefined && hasCustomOptionValue(option.attributeName()) && dualHelper.valueFromOption(this.getOptionValue(option.attributeName()), option)).forEach((option) => {
        Object.keys(option.implied).filter((impliedKey) => !hasCustomOptionValue(impliedKey)).forEach((impliedKey) => {
          this.setOptionValueWithSource(impliedKey, option.implied[impliedKey], "implied");
        });
      });
    }
    missingArgument(name) {
      const message = `error: missing required argument '${name}'`;
      this.error(message, { code: "commander.missingArgument" });
    }
    optionMissingArgument(option) {
      const message = `error: option '${option.flags}' argument missing`;
      this.error(message, { code: "commander.optionMissingArgument" });
    }
    missingMandatoryOptionValue(option) {
      const message = `error: required option '${option.flags}' not specified`;
      this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }
    _conflictingOption(option, conflictingOption) {
      const findBestOptionFromValue = (option2) => {
        const optionKey = option2.attributeName();
        const optionValue = this.getOptionValue(optionKey);
        const negativeOption = this.options.find((target) => target.negate && optionKey === target.attributeName());
        const positiveOption = this.options.find((target) => !target.negate && optionKey === target.attributeName());
        if (negativeOption && (negativeOption.presetArg === undefined && optionValue === false || negativeOption.presetArg !== undefined && optionValue === negativeOption.presetArg)) {
          return negativeOption;
        }
        return positiveOption || option2;
      };
      const getErrorMessage = (option2) => {
        const bestOption = findBestOptionFromValue(option2);
        const optionKey = bestOption.attributeName();
        const source = this.getOptionValueSource(optionKey);
        if (source === "env") {
          return `environment variable '${bestOption.envVar}'`;
        }
        return `option '${bestOption.flags}'`;
      };
      const message = `error: ${getErrorMessage(option)} cannot be used with ${getErrorMessage(conflictingOption)}`;
      this.error(message, { code: "commander.conflictingOption" });
    }
    unknownOption(flag) {
      if (this._allowUnknownOption)
        return;
      let suggestion = "";
      if (flag.startsWith("--") && this._showSuggestionAfterError) {
        let candidateFlags = [];
        let command = this;
        do {
          const moreFlags = command.createHelp().visibleOptions(command).filter((option) => option.long).map((option) => option.long);
          candidateFlags = candidateFlags.concat(moreFlags);
          command = command.parent;
        } while (command && !command._enablePositionalOptions);
        suggestion = suggestSimilar(flag, candidateFlags);
      }
      const message = `error: unknown option '${flag}'${suggestion}`;
      this.error(message, { code: "commander.unknownOption" });
    }
    _excessArguments(receivedArgs) {
      if (this._allowExcessArguments)
        return;
      const expected = this.registeredArguments.length;
      const s = expected === 1 ? "" : "s";
      const forSubcommand = this.parent ? ` for '${this.name()}'` : "";
      const message = `error: too many arguments${forSubcommand}. Expected ${expected} argument${s} but got ${receivedArgs.length}.`;
      this.error(message, { code: "commander.excessArguments" });
    }
    unknownCommand() {
      const unknownName = this.args[0];
      let suggestion = "";
      if (this._showSuggestionAfterError) {
        const candidateNames = [];
        this.createHelp().visibleCommands(this).forEach((command) => {
          candidateNames.push(command.name());
          if (command.alias())
            candidateNames.push(command.alias());
        });
        suggestion = suggestSimilar(unknownName, candidateNames);
      }
      const message = `error: unknown command '${unknownName}'${suggestion}`;
      this.error(message, { code: "commander.unknownCommand" });
    }
    version(str, flags, description) {
      if (str === undefined)
        return this._version;
      this._version = str;
      flags = flags || "-V, --version";
      description = description || "output the version number";
      const versionOption = this.createOption(flags, description);
      this._versionOptionName = versionOption.attributeName();
      this._registerOption(versionOption);
      this.on("option:" + versionOption.name(), () => {
        this._outputConfiguration.writeOut(`${str}
`);
        this._exit(0, "commander.version", str);
      });
      return this;
    }
    description(str, argsDescription) {
      if (str === undefined && argsDescription === undefined)
        return this._description;
      this._description = str;
      if (argsDescription) {
        this._argsDescription = argsDescription;
      }
      return this;
    }
    summary(str) {
      if (str === undefined)
        return this._summary;
      this._summary = str;
      return this;
    }
    alias(alias) {
      if (alias === undefined)
        return this._aliases[0];
      let command = this;
      if (this.commands.length !== 0 && this.commands[this.commands.length - 1]._executableHandler) {
        command = this.commands[this.commands.length - 1];
      }
      if (alias === command._name)
        throw new Error("Command alias can't be the same as its name");
      const matchingCommand = this.parent?._findCommand(alias);
      if (matchingCommand) {
        const existingCmd = [matchingCommand.name()].concat(matchingCommand.aliases()).join("|");
        throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingCmd}'`);
      }
      command._aliases.push(alias);
      return this;
    }
    aliases(aliases) {
      if (aliases === undefined)
        return this._aliases;
      aliases.forEach((alias) => this.alias(alias));
      return this;
    }
    usage(str) {
      if (str === undefined) {
        if (this._usage)
          return this._usage;
        const args = this.registeredArguments.map((arg) => {
          return humanReadableArgName(arg);
        });
        return [].concat(this.options.length || this._helpOption !== null ? "[options]" : [], this.commands.length ? "[command]" : [], this.registeredArguments.length ? args : []).join(" ");
      }
      this._usage = str;
      return this;
    }
    name(str) {
      if (str === undefined)
        return this._name;
      this._name = str;
      return this;
    }
    helpGroup(heading) {
      if (heading === undefined)
        return this._helpGroupHeading ?? "";
      this._helpGroupHeading = heading;
      return this;
    }
    commandsGroup(heading) {
      if (heading === undefined)
        return this._defaultCommandGroup ?? "";
      this._defaultCommandGroup = heading;
      return this;
    }
    optionsGroup(heading) {
      if (heading === undefined)
        return this._defaultOptionGroup ?? "";
      this._defaultOptionGroup = heading;
      return this;
    }
    _initOptionGroup(option) {
      if (this._defaultOptionGroup && !option.helpGroupHeading)
        option.helpGroup(this._defaultOptionGroup);
    }
    _initCommandGroup(cmd) {
      if (this._defaultCommandGroup && !cmd.helpGroup())
        cmd.helpGroup(this._defaultCommandGroup);
    }
    nameFromFilename(filename) {
      this._name = path.basename(filename, path.extname(filename));
      return this;
    }
    executableDir(path2) {
      if (path2 === undefined)
        return this._executableDir;
      this._executableDir = path2;
      return this;
    }
    helpInformation(contextOptions) {
      const helper = this.createHelp();
      const context = this._getOutputContext(contextOptions);
      helper.prepareContext({
        error: context.error,
        helpWidth: context.helpWidth,
        outputHasColors: context.hasColors
      });
      const text = helper.formatHelp(this, helper);
      if (context.hasColors)
        return text;
      return this._outputConfiguration.stripColor(text);
    }
    _getOutputContext(contextOptions) {
      contextOptions = contextOptions || {};
      const error = !!contextOptions.error;
      let baseWrite;
      let hasColors;
      let helpWidth;
      if (error) {
        baseWrite = (str) => this._outputConfiguration.writeErr(str);
        hasColors = this._outputConfiguration.getErrHasColors();
        helpWidth = this._outputConfiguration.getErrHelpWidth();
      } else {
        baseWrite = (str) => this._outputConfiguration.writeOut(str);
        hasColors = this._outputConfiguration.getOutHasColors();
        helpWidth = this._outputConfiguration.getOutHelpWidth();
      }
      const write = (str) => {
        if (!hasColors)
          str = this._outputConfiguration.stripColor(str);
        return baseWrite(str);
      };
      return { error, write, hasColors, helpWidth };
    }
    outputHelp(contextOptions) {
      let deprecatedCallback;
      if (typeof contextOptions === "function") {
        deprecatedCallback = contextOptions;
        contextOptions = undefined;
      }
      const outputContext = this._getOutputContext(contextOptions);
      const eventContext = {
        error: outputContext.error,
        write: outputContext.write,
        command: this
      };
      this._getCommandAndAncestors().reverse().forEach((command) => command.emit("beforeAllHelp", eventContext));
      this.emit("beforeHelp", eventContext);
      let helpInformation = this.helpInformation({ error: outputContext.error });
      if (deprecatedCallback) {
        helpInformation = deprecatedCallback(helpInformation);
        if (typeof helpInformation !== "string" && !Buffer.isBuffer(helpInformation)) {
          throw new Error("outputHelp callback must return a string or a Buffer");
        }
      }
      outputContext.write(helpInformation);
      if (this._getHelpOption()?.long) {
        this.emit(this._getHelpOption().long);
      }
      this.emit("afterHelp", eventContext);
      this._getCommandAndAncestors().forEach((command) => command.emit("afterAllHelp", eventContext));
    }
    helpOption(flags, description) {
      if (typeof flags === "boolean") {
        if (flags) {
          if (this._helpOption === null)
            this._helpOption = undefined;
          if (this._defaultOptionGroup) {
            this._initOptionGroup(this._getHelpOption());
          }
        } else {
          this._helpOption = null;
        }
        return this;
      }
      this._helpOption = this.createOption(flags ?? "-h, --help", description ?? "display help for command");
      if (flags || description)
        this._initOptionGroup(this._helpOption);
      return this;
    }
    _getHelpOption() {
      if (this._helpOption === undefined) {
        this.helpOption(undefined, undefined);
      }
      return this._helpOption;
    }
    addHelpOption(option) {
      this._helpOption = option;
      this._initOptionGroup(option);
      return this;
    }
    help(contextOptions) {
      this.outputHelp(contextOptions);
      let exitCode = Number(process2.exitCode ?? 0);
      if (exitCode === 0 && contextOptions && typeof contextOptions !== "function" && contextOptions.error) {
        exitCode = 1;
      }
      this._exit(exitCode, "commander.help", "(outputHelp)");
    }
    addHelpText(position, text) {
      const allowedValues = ["beforeAll", "before", "after", "afterAll"];
      if (!allowedValues.includes(position)) {
        throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${allowedValues.join("', '")}'`);
      }
      const helpEvent = `${position}Help`;
      this.on(helpEvent, (context) => {
        let helpStr;
        if (typeof text === "function") {
          helpStr = text({ error: context.error, command: context.command });
        } else {
          helpStr = text;
        }
        if (helpStr) {
          context.write(`${helpStr}
`);
        }
      });
      return this;
    }
    _outputHelpIfRequested(args) {
      const helpOption = this._getHelpOption();
      const helpRequested = helpOption && args.find((arg) => helpOption.is(arg));
      if (helpRequested) {
        this.outputHelp();
        this._exit(0, "commander.helpDisplayed", "(outputHelp)");
      }
    }
  }
  function incrementNodeInspectorPort(args) {
    return args.map((arg) => {
      if (!arg.startsWith("--inspect")) {
        return arg;
      }
      let debugOption;
      let debugHost = "127.0.0.1";
      let debugPort = "9229";
      let match;
      if ((match = arg.match(/^(--inspect(-brk)?)$/)) !== null) {
        debugOption = match[1];
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+)$/)) !== null) {
        debugOption = match[1];
        if (/^\d+$/.test(match[3])) {
          debugPort = match[3];
        } else {
          debugHost = match[3];
        }
      } else if ((match = arg.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/)) !== null) {
        debugOption = match[1];
        debugHost = match[3];
        debugPort = match[4];
      }
      if (debugOption && debugPort !== "0") {
        return `${debugOption}=${debugHost}:${parseInt(debugPort) + 1}`;
      }
      return arg;
    });
  }
  function useColor() {
    if (process2.env.NO_COLOR || process2.env.FORCE_COLOR === "0" || process2.env.FORCE_COLOR === "false")
      return false;
    if (process2.env.FORCE_COLOR || process2.env.CLICOLOR_FORCE !== undefined)
      return true;
    return;
  }
  exports.Command = Command;
  exports.useColor = useColor;
});

// node_modules/commander/index.js
var require_commander = __commonJS((exports) => {
  var { Argument } = require_argument();
  var { Command } = require_command();
  var { CommanderError, InvalidArgumentError } = require_error();
  var { Help } = require_help();
  var { Option } = require_option();
  exports.program = new Command;
  exports.createCommand = (name) => new Command(name);
  exports.createOption = (flags, description) => new Option(flags, description);
  exports.createArgument = (name, description) => new Argument(name, description);
  exports.Command = Command;
  exports.Option = Option;
  exports.Argument = Argument;
  exports.Help = Help;
  exports.CommanderError = CommanderError;
  exports.InvalidArgumentError = InvalidArgumentError;
  exports.InvalidOptionArgumentError = InvalidArgumentError;
});

// src/utils/command.ts
var exports_command = {};
__export(exports_command, {
  runCommand: () => runCommand
});
import { spawn } from "child_process";
async function runCommand(command, args = [], cwd, stdin) {
  let cmdToExecute;
  let argsToExecute;
  if (command === "sudo") {
    cmdToExecute = "sudo";
    argsToExecute = args;
  } else {
    cmdToExecute = command;
    argsToExecute = args;
  }
  return new Promise((resolve, reject) => {
    const child = spawn(cmdToExecute, argsToExecute, {
      stdio: stdin ? ["pipe", "pipe", "pipe"] : ["inherit", "pipe", "pipe"],
      cwd
    });
    let stdout = "";
    let stderr = "";
    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code
      });
    });
    child.on("error", (err) => {
      reject(new Error(`Failed to start command "${cmdToExecute} ${argsToExecute.join(" ")}": ${err.message}`));
    });
  });
}
var init_command = () => {};

// node_modules/yaml/dist/nodes/identity.js
var require_identity = __commonJS((exports) => {
  var ALIAS = Symbol.for("yaml.alias");
  var DOC = Symbol.for("yaml.document");
  var MAP = Symbol.for("yaml.map");
  var PAIR = Symbol.for("yaml.pair");
  var SCALAR = Symbol.for("yaml.scalar");
  var SEQ = Symbol.for("yaml.seq");
  var NODE_TYPE = Symbol.for("yaml.node.type");
  var isAlias = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === ALIAS;
  var isDocument = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === DOC;
  var isMap = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === MAP;
  var isPair = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === PAIR;
  var isScalar = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SCALAR;
  var isSeq = (node) => !!node && typeof node === "object" && node[NODE_TYPE] === SEQ;
  function isCollection(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case MAP:
        case SEQ:
          return true;
      }
    return false;
  }
  function isNode(node) {
    if (node && typeof node === "object")
      switch (node[NODE_TYPE]) {
        case ALIAS:
        case MAP:
        case SCALAR:
        case SEQ:
          return true;
      }
    return false;
  }
  var hasAnchor = (node) => (isScalar(node) || isCollection(node)) && !!node.anchor;
  exports.ALIAS = ALIAS;
  exports.DOC = DOC;
  exports.MAP = MAP;
  exports.NODE_TYPE = NODE_TYPE;
  exports.PAIR = PAIR;
  exports.SCALAR = SCALAR;
  exports.SEQ = SEQ;
  exports.hasAnchor = hasAnchor;
  exports.isAlias = isAlias;
  exports.isCollection = isCollection;
  exports.isDocument = isDocument;
  exports.isMap = isMap;
  exports.isNode = isNode;
  exports.isPair = isPair;
  exports.isScalar = isScalar;
  exports.isSeq = isSeq;
});

// node_modules/yaml/dist/visit.js
var require_visit = __commonJS((exports) => {
  var identity = require_identity();
  var BREAK = Symbol("break visit");
  var SKIP = Symbol("skip children");
  var REMOVE = Symbol("remove node");
  function visit(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
      const cd = visit_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      visit_(null, node, visitor_, Object.freeze([]));
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  function visit_(key, node, visitor, path2) {
    const ctrl = callVisitor(key, node, visitor, path2);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
      replaceNode(key, path2, ctrl);
      return visit_(key, ctrl, visitor, path2);
    }
    if (typeof ctrl !== "symbol") {
      if (identity.isCollection(node)) {
        path2 = Object.freeze(path2.concat(node));
        for (let i = 0;i < node.items.length; ++i) {
          const ci = visit_(i, node.items[i], visitor, path2);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity.isPair(node)) {
        path2 = Object.freeze(path2.concat(node));
        const ck = visit_("key", node.key, visitor, path2);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = visit_("value", node.value, visitor, path2);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  async function visitAsync(node, visitor) {
    const visitor_ = initVisitor(visitor);
    if (identity.isDocument(node)) {
      const cd = await visitAsync_(null, node.contents, visitor_, Object.freeze([node]));
      if (cd === REMOVE)
        node.contents = null;
    } else
      await visitAsync_(null, node, visitor_, Object.freeze([]));
  }
  visitAsync.BREAK = BREAK;
  visitAsync.SKIP = SKIP;
  visitAsync.REMOVE = REMOVE;
  async function visitAsync_(key, node, visitor, path2) {
    const ctrl = await callVisitor(key, node, visitor, path2);
    if (identity.isNode(ctrl) || identity.isPair(ctrl)) {
      replaceNode(key, path2, ctrl);
      return visitAsync_(key, ctrl, visitor, path2);
    }
    if (typeof ctrl !== "symbol") {
      if (identity.isCollection(node)) {
        path2 = Object.freeze(path2.concat(node));
        for (let i = 0;i < node.items.length; ++i) {
          const ci = await visitAsync_(i, node.items[i], visitor, path2);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            node.items.splice(i, 1);
            i -= 1;
          }
        }
      } else if (identity.isPair(node)) {
        path2 = Object.freeze(path2.concat(node));
        const ck = await visitAsync_("key", node.key, visitor, path2);
        if (ck === BREAK)
          return BREAK;
        else if (ck === REMOVE)
          node.key = null;
        const cv = await visitAsync_("value", node.value, visitor, path2);
        if (cv === BREAK)
          return BREAK;
        else if (cv === REMOVE)
          node.value = null;
      }
    }
    return ctrl;
  }
  function initVisitor(visitor) {
    if (typeof visitor === "object" && (visitor.Collection || visitor.Node || visitor.Value)) {
      return Object.assign({
        Alias: visitor.Node,
        Map: visitor.Node,
        Scalar: visitor.Node,
        Seq: visitor.Node
      }, visitor.Value && {
        Map: visitor.Value,
        Scalar: visitor.Value,
        Seq: visitor.Value
      }, visitor.Collection && {
        Map: visitor.Collection,
        Seq: visitor.Collection
      }, visitor);
    }
    return visitor;
  }
  function callVisitor(key, node, visitor, path2) {
    if (typeof visitor === "function")
      return visitor(key, node, path2);
    if (identity.isMap(node))
      return visitor.Map?.(key, node, path2);
    if (identity.isSeq(node))
      return visitor.Seq?.(key, node, path2);
    if (identity.isPair(node))
      return visitor.Pair?.(key, node, path2);
    if (identity.isScalar(node))
      return visitor.Scalar?.(key, node, path2);
    if (identity.isAlias(node))
      return visitor.Alias?.(key, node, path2);
    return;
  }
  function replaceNode(key, path2, node) {
    const parent = path2[path2.length - 1];
    if (identity.isCollection(parent)) {
      parent.items[key] = node;
    } else if (identity.isPair(parent)) {
      if (key === "key")
        parent.key = node;
      else
        parent.value = node;
    } else if (identity.isDocument(parent)) {
      parent.contents = node;
    } else {
      const pt = identity.isAlias(parent) ? "alias" : "scalar";
      throw new Error(`Cannot replace node with ${pt} parent`);
    }
  }
  exports.visit = visit;
  exports.visitAsync = visitAsync;
});

// node_modules/yaml/dist/doc/directives.js
var require_directives = __commonJS((exports) => {
  var identity = require_identity();
  var visit = require_visit();
  var escapeChars = {
    "!": "%21",
    ",": "%2C",
    "[": "%5B",
    "]": "%5D",
    "{": "%7B",
    "}": "%7D"
  };
  var escapeTagName = (tn) => tn.replace(/[!,[\]{}]/g, (ch) => escapeChars[ch]);

  class Directives {
    constructor(yaml, tags) {
      this.docStart = null;
      this.docEnd = false;
      this.yaml = Object.assign({}, Directives.defaultYaml, yaml);
      this.tags = Object.assign({}, Directives.defaultTags, tags);
    }
    clone() {
      const copy = new Directives(this.yaml, this.tags);
      copy.docStart = this.docStart;
      return copy;
    }
    atDocument() {
      const res = new Directives(this.yaml, this.tags);
      switch (this.yaml.version) {
        case "1.1":
          this.atNextDocument = true;
          break;
        case "1.2":
          this.atNextDocument = false;
          this.yaml = {
            explicit: Directives.defaultYaml.explicit,
            version: "1.2"
          };
          this.tags = Object.assign({}, Directives.defaultTags);
          break;
      }
      return res;
    }
    add(line, onError) {
      if (this.atNextDocument) {
        this.yaml = { explicit: Directives.defaultYaml.explicit, version: "1.1" };
        this.tags = Object.assign({}, Directives.defaultTags);
        this.atNextDocument = false;
      }
      const parts = line.trim().split(/[ \t]+/);
      const name = parts.shift();
      switch (name) {
        case "%TAG": {
          if (parts.length !== 2) {
            onError(0, "%TAG directive should contain exactly two parts");
            if (parts.length < 2)
              return false;
          }
          const [handle, prefix] = parts;
          this.tags[handle] = prefix;
          return true;
        }
        case "%YAML": {
          this.yaml.explicit = true;
          if (parts.length !== 1) {
            onError(0, "%YAML directive should contain exactly one part");
            return false;
          }
          const [version] = parts;
          if (version === "1.1" || version === "1.2") {
            this.yaml.version = version;
            return true;
          } else {
            const isValid = /^\d+\.\d+$/.test(version);
            onError(6, `Unsupported YAML version ${version}`, isValid);
            return false;
          }
        }
        default:
          onError(0, `Unknown directive ${name}`, true);
          return false;
      }
    }
    tagName(source, onError) {
      if (source === "!")
        return "!";
      if (source[0] !== "!") {
        onError(`Not a valid tag: ${source}`);
        return null;
      }
      if (source[1] === "<") {
        const verbatim = source.slice(2, -1);
        if (verbatim === "!" || verbatim === "!!") {
          onError(`Verbatim tags aren't resolved, so ${source} is invalid.`);
          return null;
        }
        if (source[source.length - 1] !== ">")
          onError("Verbatim tags must end with a >");
        return verbatim;
      }
      const [, handle, suffix] = source.match(/^(.*!)([^!]*)$/s);
      if (!suffix)
        onError(`The ${source} tag has no suffix`);
      const prefix = this.tags[handle];
      if (prefix) {
        try {
          return prefix + decodeURIComponent(suffix);
        } catch (error) {
          onError(String(error));
          return null;
        }
      }
      if (handle === "!")
        return source;
      onError(`Could not resolve tag: ${source}`);
      return null;
    }
    tagString(tag) {
      for (const [handle, prefix] of Object.entries(this.tags)) {
        if (tag.startsWith(prefix))
          return handle + escapeTagName(tag.substring(prefix.length));
      }
      return tag[0] === "!" ? tag : `!<${tag}>`;
    }
    toString(doc) {
      const lines = this.yaml.explicit ? [`%YAML ${this.yaml.version || "1.2"}`] : [];
      const tagEntries = Object.entries(this.tags);
      let tagNames;
      if (doc && tagEntries.length > 0 && identity.isNode(doc.contents)) {
        const tags = {};
        visit.visit(doc.contents, (_key, node) => {
          if (identity.isNode(node) && node.tag)
            tags[node.tag] = true;
        });
        tagNames = Object.keys(tags);
      } else
        tagNames = [];
      for (const [handle, prefix] of tagEntries) {
        if (handle === "!!" && prefix === "tag:yaml.org,2002:")
          continue;
        if (!doc || tagNames.some((tn) => tn.startsWith(prefix)))
          lines.push(`%TAG ${handle} ${prefix}`);
      }
      return lines.join(`
`);
    }
  }
  Directives.defaultYaml = { explicit: false, version: "1.2" };
  Directives.defaultTags = { "!!": "tag:yaml.org,2002:" };
  exports.Directives = Directives;
});

// node_modules/yaml/dist/doc/anchors.js
var require_anchors = __commonJS((exports) => {
  var identity = require_identity();
  var visit = require_visit();
  function anchorIsValid(anchor) {
    if (/[\x00-\x19\s,[\]{}]/.test(anchor)) {
      const sa = JSON.stringify(anchor);
      const msg = `Anchor must not contain whitespace or control characters: ${sa}`;
      throw new Error(msg);
    }
    return true;
  }
  function anchorNames(root) {
    const anchors = new Set;
    visit.visit(root, {
      Value(_key, node) {
        if (node.anchor)
          anchors.add(node.anchor);
      }
    });
    return anchors;
  }
  function findNewAnchor(prefix, exclude) {
    for (let i = 1;; ++i) {
      const name = `${prefix}${i}`;
      if (!exclude.has(name))
        return name;
    }
  }
  function createNodeAnchors(doc, prefix) {
    const aliasObjects = [];
    const sourceObjects = new Map;
    let prevAnchors = null;
    return {
      onAnchor: (source) => {
        aliasObjects.push(source);
        prevAnchors ?? (prevAnchors = anchorNames(doc));
        const anchor = findNewAnchor(prefix, prevAnchors);
        prevAnchors.add(anchor);
        return anchor;
      },
      setAnchors: () => {
        for (const source of aliasObjects) {
          const ref = sourceObjects.get(source);
          if (typeof ref === "object" && ref.anchor && (identity.isScalar(ref.node) || identity.isCollection(ref.node))) {
            ref.node.anchor = ref.anchor;
          } else {
            const error = new Error("Failed to resolve repeated object (this should not happen)");
            error.source = source;
            throw error;
          }
        }
      },
      sourceObjects
    };
  }
  exports.anchorIsValid = anchorIsValid;
  exports.anchorNames = anchorNames;
  exports.createNodeAnchors = createNodeAnchors;
  exports.findNewAnchor = findNewAnchor;
});

// node_modules/yaml/dist/doc/applyReviver.js
var require_applyReviver = __commonJS((exports) => {
  function applyReviver(reviver, obj, key, val) {
    if (val && typeof val === "object") {
      if (Array.isArray(val)) {
        for (let i = 0, len = val.length;i < len; ++i) {
          const v0 = val[i];
          const v1 = applyReviver(reviver, val, String(i), v0);
          if (v1 === undefined)
            delete val[i];
          else if (v1 !== v0)
            val[i] = v1;
        }
      } else if (val instanceof Map) {
        for (const k of Array.from(val.keys())) {
          const v0 = val.get(k);
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === undefined)
            val.delete(k);
          else if (v1 !== v0)
            val.set(k, v1);
        }
      } else if (val instanceof Set) {
        for (const v0 of Array.from(val)) {
          const v1 = applyReviver(reviver, val, v0, v0);
          if (v1 === undefined)
            val.delete(v0);
          else if (v1 !== v0) {
            val.delete(v0);
            val.add(v1);
          }
        }
      } else {
        for (const [k, v0] of Object.entries(val)) {
          const v1 = applyReviver(reviver, val, k, v0);
          if (v1 === undefined)
            delete val[k];
          else if (v1 !== v0)
            val[k] = v1;
        }
      }
    }
    return reviver.call(obj, key, val);
  }
  exports.applyReviver = applyReviver;
});

// node_modules/yaml/dist/nodes/toJS.js
var require_toJS = __commonJS((exports) => {
  var identity = require_identity();
  function toJS(value, arg, ctx) {
    if (Array.isArray(value))
      return value.map((v, i) => toJS(v, String(i), ctx));
    if (value && typeof value.toJSON === "function") {
      if (!ctx || !identity.hasAnchor(value))
        return value.toJSON(arg, ctx);
      const data = { aliasCount: 0, count: 1, res: undefined };
      ctx.anchors.set(value, data);
      ctx.onCreate = (res2) => {
        data.res = res2;
        delete ctx.onCreate;
      };
      const res = value.toJSON(arg, ctx);
      if (ctx.onCreate)
        ctx.onCreate(res);
      return res;
    }
    if (typeof value === "bigint" && !ctx?.keep)
      return Number(value);
    return value;
  }
  exports.toJS = toJS;
});

// node_modules/yaml/dist/nodes/Node.js
var require_Node = __commonJS((exports) => {
  var applyReviver = require_applyReviver();
  var identity = require_identity();
  var toJS = require_toJS();

  class NodeBase {
    constructor(type) {
      Object.defineProperty(this, identity.NODE_TYPE, { value: type });
    }
    clone() {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    toJS(doc, { mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      if (!identity.isDocument(doc))
        throw new TypeError("A document argument is required");
      const ctx = {
        anchors: new Map,
        doc,
        keep: true,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS.toJS(this, "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
    }
  }
  exports.NodeBase = NodeBase;
});

// node_modules/yaml/dist/nodes/Alias.js
var require_Alias = __commonJS((exports) => {
  var anchors = require_anchors();
  var visit = require_visit();
  var identity = require_identity();
  var Node = require_Node();
  var toJS = require_toJS();

  class Alias extends Node.NodeBase {
    constructor(source) {
      super(identity.ALIAS);
      this.source = source;
      Object.defineProperty(this, "tag", {
        set() {
          throw new Error("Alias nodes cannot have tags");
        }
      });
    }
    resolve(doc, ctx) {
      let nodes;
      if (ctx?.aliasResolveCache) {
        nodes = ctx.aliasResolveCache;
      } else {
        nodes = [];
        visit.visit(doc, {
          Node: (_key, node) => {
            if (identity.isAlias(node) || identity.hasAnchor(node))
              nodes.push(node);
          }
        });
        if (ctx)
          ctx.aliasResolveCache = nodes;
      }
      let found = undefined;
      for (const node of nodes) {
        if (node === this)
          break;
        if (node.anchor === this.source)
          found = node;
      }
      return found;
    }
    toJSON(_arg, ctx) {
      if (!ctx)
        return { source: this.source };
      const { anchors: anchors2, doc, maxAliasCount } = ctx;
      const source = this.resolve(doc, ctx);
      if (!source) {
        const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
        throw new ReferenceError(msg);
      }
      let data = anchors2.get(source);
      if (!data) {
        toJS.toJS(source, null, ctx);
        data = anchors2.get(source);
      }
      if (data?.res === undefined) {
        const msg = "This should not happen: Alias anchor was not resolved?";
        throw new ReferenceError(msg);
      }
      if (maxAliasCount >= 0) {
        data.count += 1;
        if (data.aliasCount === 0)
          data.aliasCount = getAliasCount(doc, source, anchors2);
        if (data.count * data.aliasCount > maxAliasCount) {
          const msg = "Excessive alias count indicates a resource exhaustion attack";
          throw new ReferenceError(msg);
        }
      }
      return data.res;
    }
    toString(ctx, _onComment, _onChompKeep) {
      const src = `*${this.source}`;
      if (ctx) {
        anchors.anchorIsValid(this.source);
        if (ctx.options.verifyAliasOrder && !ctx.anchors.has(this.source)) {
          const msg = `Unresolved alias (the anchor must be set before the alias): ${this.source}`;
          throw new Error(msg);
        }
        if (ctx.implicitKey)
          return `${src} `;
      }
      return src;
    }
  }
  function getAliasCount(doc, node, anchors2) {
    if (identity.isAlias(node)) {
      const source = node.resolve(doc);
      const anchor = anchors2 && source && anchors2.get(source);
      return anchor ? anchor.count * anchor.aliasCount : 0;
    } else if (identity.isCollection(node)) {
      let count = 0;
      for (const item of node.items) {
        const c = getAliasCount(doc, item, anchors2);
        if (c > count)
          count = c;
      }
      return count;
    } else if (identity.isPair(node)) {
      const kc = getAliasCount(doc, node.key, anchors2);
      const vc = getAliasCount(doc, node.value, anchors2);
      return Math.max(kc, vc);
    }
    return 1;
  }
  exports.Alias = Alias;
});

// node_modules/yaml/dist/nodes/Scalar.js
var require_Scalar = __commonJS((exports) => {
  var identity = require_identity();
  var Node = require_Node();
  var toJS = require_toJS();
  var isScalarValue = (value) => !value || typeof value !== "function" && typeof value !== "object";

  class Scalar extends Node.NodeBase {
    constructor(value) {
      super(identity.SCALAR);
      this.value = value;
    }
    toJSON(arg, ctx) {
      return ctx?.keep ? this.value : toJS.toJS(this.value, arg, ctx);
    }
    toString() {
      return String(this.value);
    }
  }
  Scalar.BLOCK_FOLDED = "BLOCK_FOLDED";
  Scalar.BLOCK_LITERAL = "BLOCK_LITERAL";
  Scalar.PLAIN = "PLAIN";
  Scalar.QUOTE_DOUBLE = "QUOTE_DOUBLE";
  Scalar.QUOTE_SINGLE = "QUOTE_SINGLE";
  exports.Scalar = Scalar;
  exports.isScalarValue = isScalarValue;
});

// node_modules/yaml/dist/doc/createNode.js
var require_createNode = __commonJS((exports) => {
  var Alias = require_Alias();
  var identity = require_identity();
  var Scalar = require_Scalar();
  var defaultTagPrefix = "tag:yaml.org,2002:";
  function findTagObject(value, tagName, tags) {
    if (tagName) {
      const match = tags.filter((t) => t.tag === tagName);
      const tagObj = match.find((t) => !t.format) ?? match[0];
      if (!tagObj)
        throw new Error(`Tag ${tagName} not found`);
      return tagObj;
    }
    return tags.find((t) => t.identify?.(value) && !t.format);
  }
  function createNode(value, tagName, ctx) {
    if (identity.isDocument(value))
      value = value.contents;
    if (identity.isNode(value))
      return value;
    if (identity.isPair(value)) {
      const map = ctx.schema[identity.MAP].createNode?.(ctx.schema, null, ctx);
      map.items.push(value);
      return map;
    }
    if (value instanceof String || value instanceof Number || value instanceof Boolean || typeof BigInt !== "undefined" && value instanceof BigInt) {
      value = value.valueOf();
    }
    const { aliasDuplicateObjects, onAnchor, onTagObj, schema, sourceObjects } = ctx;
    let ref = undefined;
    if (aliasDuplicateObjects && value && typeof value === "object") {
      ref = sourceObjects.get(value);
      if (ref) {
        ref.anchor ?? (ref.anchor = onAnchor(value));
        return new Alias.Alias(ref.anchor);
      } else {
        ref = { anchor: null, node: null };
        sourceObjects.set(value, ref);
      }
    }
    if (tagName?.startsWith("!!"))
      tagName = defaultTagPrefix + tagName.slice(2);
    let tagObj = findTagObject(value, tagName, schema.tags);
    if (!tagObj) {
      if (value && typeof value.toJSON === "function") {
        value = value.toJSON();
      }
      if (!value || typeof value !== "object") {
        const node2 = new Scalar.Scalar(value);
        if (ref)
          ref.node = node2;
        return node2;
      }
      tagObj = value instanceof Map ? schema[identity.MAP] : (Symbol.iterator in Object(value)) ? schema[identity.SEQ] : schema[identity.MAP];
    }
    if (onTagObj) {
      onTagObj(tagObj);
      delete ctx.onTagObj;
    }
    const node = tagObj?.createNode ? tagObj.createNode(ctx.schema, value, ctx) : typeof tagObj?.nodeClass?.from === "function" ? tagObj.nodeClass.from(ctx.schema, value, ctx) : new Scalar.Scalar(value);
    if (tagName)
      node.tag = tagName;
    else if (!tagObj.default)
      node.tag = tagObj.tag;
    if (ref)
      ref.node = node;
    return node;
  }
  exports.createNode = createNode;
});

// node_modules/yaml/dist/nodes/Collection.js
var require_Collection = __commonJS((exports) => {
  var createNode = require_createNode();
  var identity = require_identity();
  var Node = require_Node();
  function collectionFromPath(schema, path2, value) {
    let v = value;
    for (let i = path2.length - 1;i >= 0; --i) {
      const k = path2[i];
      if (typeof k === "number" && Number.isInteger(k) && k >= 0) {
        const a = [];
        a[k] = v;
        v = a;
      } else {
        v = new Map([[k, v]]);
      }
    }
    return createNode.createNode(v, undefined, {
      aliasDuplicateObjects: false,
      keepUndefined: false,
      onAnchor: () => {
        throw new Error("This should not happen, please report a bug.");
      },
      schema,
      sourceObjects: new Map
    });
  }
  var isEmptyPath = (path2) => path2 == null || typeof path2 === "object" && !!path2[Symbol.iterator]().next().done;

  class Collection extends Node.NodeBase {
    constructor(type, schema) {
      super(type);
      Object.defineProperty(this, "schema", {
        value: schema,
        configurable: true,
        enumerable: false,
        writable: true
      });
    }
    clone(schema) {
      const copy = Object.create(Object.getPrototypeOf(this), Object.getOwnPropertyDescriptors(this));
      if (schema)
        copy.schema = schema;
      copy.items = copy.items.map((it) => identity.isNode(it) || identity.isPair(it) ? it.clone(schema) : it);
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    addIn(path2, value) {
      if (isEmptyPath(path2))
        this.add(value);
      else {
        const [key, ...rest] = path2;
        const node = this.get(key, true);
        if (identity.isCollection(node))
          node.addIn(rest, value);
        else if (node === undefined && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
    deleteIn(path2) {
      const [key, ...rest] = path2;
      if (rest.length === 0)
        return this.delete(key);
      const node = this.get(key, true);
      if (identity.isCollection(node))
        return node.deleteIn(rest);
      else
        throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
    }
    getIn(path2, keepScalar) {
      const [key, ...rest] = path2;
      const node = this.get(key, true);
      if (rest.length === 0)
        return !keepScalar && identity.isScalar(node) ? node.value : node;
      else
        return identity.isCollection(node) ? node.getIn(rest, keepScalar) : undefined;
    }
    hasAllNullValues(allowScalar) {
      return this.items.every((node) => {
        if (!identity.isPair(node))
          return false;
        const n = node.value;
        return n == null || allowScalar && identity.isScalar(n) && n.value == null && !n.commentBefore && !n.comment && !n.tag;
      });
    }
    hasIn(path2) {
      const [key, ...rest] = path2;
      if (rest.length === 0)
        return this.has(key);
      const node = this.get(key, true);
      return identity.isCollection(node) ? node.hasIn(rest) : false;
    }
    setIn(path2, value) {
      const [key, ...rest] = path2;
      if (rest.length === 0) {
        this.set(key, value);
      } else {
        const node = this.get(key, true);
        if (identity.isCollection(node))
          node.setIn(rest, value);
        else if (node === undefined && this.schema)
          this.set(key, collectionFromPath(this.schema, rest, value));
        else
          throw new Error(`Expected YAML collection at ${key}. Remaining path: ${rest}`);
      }
    }
  }
  exports.Collection = Collection;
  exports.collectionFromPath = collectionFromPath;
  exports.isEmptyPath = isEmptyPath;
});

// node_modules/yaml/dist/stringify/stringifyComment.js
var require_stringifyComment = __commonJS((exports) => {
  var stringifyComment = (str) => str.replace(/^(?!$)(?: $)?/gm, "#");
  function indentComment(comment, indent) {
    if (/^\n+$/.test(comment))
      return comment.substring(1);
    return indent ? comment.replace(/^(?! *$)/gm, indent) : comment;
  }
  var lineComment = (str, indent, comment) => str.endsWith(`
`) ? indentComment(comment, indent) : comment.includes(`
`) ? `
` + indentComment(comment, indent) : (str.endsWith(" ") ? "" : " ") + comment;
  exports.indentComment = indentComment;
  exports.lineComment = lineComment;
  exports.stringifyComment = stringifyComment;
});

// node_modules/yaml/dist/stringify/foldFlowLines.js
var require_foldFlowLines = __commonJS((exports) => {
  var FOLD_FLOW = "flow";
  var FOLD_BLOCK = "block";
  var FOLD_QUOTED = "quoted";
  function foldFlowLines(text, indent, mode = "flow", { indentAtStart, lineWidth = 80, minContentWidth = 20, onFold, onOverflow } = {}) {
    if (!lineWidth || lineWidth < 0)
      return text;
    if (lineWidth < minContentWidth)
      minContentWidth = 0;
    const endStep = Math.max(1 + minContentWidth, 1 + lineWidth - indent.length);
    if (text.length <= endStep)
      return text;
    const folds = [];
    const escapedFolds = {};
    let end = lineWidth - indent.length;
    if (typeof indentAtStart === "number") {
      if (indentAtStart > lineWidth - Math.max(2, minContentWidth))
        folds.push(0);
      else
        end = lineWidth - indentAtStart;
    }
    let split = undefined;
    let prev = undefined;
    let overflow = false;
    let i = -1;
    let escStart = -1;
    let escEnd = -1;
    if (mode === FOLD_BLOCK) {
      i = consumeMoreIndentedLines(text, i, indent.length);
      if (i !== -1)
        end = i + endStep;
    }
    for (let ch;ch = text[i += 1]; ) {
      if (mode === FOLD_QUOTED && ch === "\\") {
        escStart = i;
        switch (text[i + 1]) {
          case "x":
            i += 3;
            break;
          case "u":
            i += 5;
            break;
          case "U":
            i += 9;
            break;
          default:
            i += 1;
        }
        escEnd = i;
      }
      if (ch === `
`) {
        if (mode === FOLD_BLOCK)
          i = consumeMoreIndentedLines(text, i, indent.length);
        end = i + indent.length + endStep;
        split = undefined;
      } else {
        if (ch === " " && prev && prev !== " " && prev !== `
` && prev !== "\t") {
          const next = text[i + 1];
          if (next && next !== " " && next !== `
` && next !== "\t")
            split = i;
        }
        if (i >= end) {
          if (split) {
            folds.push(split);
            end = split + endStep;
            split = undefined;
          } else if (mode === FOLD_QUOTED) {
            while (prev === " " || prev === "\t") {
              prev = ch;
              ch = text[i += 1];
              overflow = true;
            }
            const j = i > escEnd + 1 ? i - 2 : escStart - 1;
            if (escapedFolds[j])
              return text;
            folds.push(j);
            escapedFolds[j] = true;
            end = j + endStep;
            split = undefined;
          } else {
            overflow = true;
          }
        }
      }
      prev = ch;
    }
    if (overflow && onOverflow)
      onOverflow();
    if (folds.length === 0)
      return text;
    if (onFold)
      onFold();
    let res = text.slice(0, folds[0]);
    for (let i2 = 0;i2 < folds.length; ++i2) {
      const fold = folds[i2];
      const end2 = folds[i2 + 1] || text.length;
      if (fold === 0)
        res = `
${indent}${text.slice(0, end2)}`;
      else {
        if (mode === FOLD_QUOTED && escapedFolds[fold])
          res += `${text[fold]}\\`;
        res += `
${indent}${text.slice(fold + 1, end2)}`;
      }
    }
    return res;
  }
  function consumeMoreIndentedLines(text, i, indent) {
    let end = i;
    let start = i + 1;
    let ch = text[start];
    while (ch === " " || ch === "\t") {
      if (i < start + indent) {
        ch = text[++i];
      } else {
        do {
          ch = text[++i];
        } while (ch && ch !== `
`);
        end = i;
        start = i + 1;
        ch = text[start];
      }
    }
    return end;
  }
  exports.FOLD_BLOCK = FOLD_BLOCK;
  exports.FOLD_FLOW = FOLD_FLOW;
  exports.FOLD_QUOTED = FOLD_QUOTED;
  exports.foldFlowLines = foldFlowLines;
});

// node_modules/yaml/dist/stringify/stringifyString.js
var require_stringifyString = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var foldFlowLines = require_foldFlowLines();
  var getFoldOptions = (ctx, isBlock) => ({
    indentAtStart: isBlock ? ctx.indent.length : ctx.indentAtStart,
    lineWidth: ctx.options.lineWidth,
    minContentWidth: ctx.options.minContentWidth
  });
  var containsDocumentMarker = (str) => /^(%|---|\.\.\.)/m.test(str);
  function lineLengthOverLimit(str, lineWidth, indentLength) {
    if (!lineWidth || lineWidth < 0)
      return false;
    const limit = lineWidth - indentLength;
    const strLen = str.length;
    if (strLen <= limit)
      return false;
    for (let i = 0, start = 0;i < strLen; ++i) {
      if (str[i] === `
`) {
        if (i - start > limit)
          return true;
        start = i + 1;
        if (strLen - start <= limit)
          return false;
      }
    }
    return true;
  }
  function doubleQuotedString(value, ctx) {
    const json = JSON.stringify(value);
    if (ctx.options.doubleQuotedAsJSON)
      return json;
    const { implicitKey } = ctx;
    const minMultiLineLength = ctx.options.doubleQuotedMinMultiLineLength;
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    let str = "";
    let start = 0;
    for (let i = 0, ch = json[i];ch; ch = json[++i]) {
      if (ch === " " && json[i + 1] === "\\" && json[i + 2] === "n") {
        str += json.slice(start, i) + "\\ ";
        i += 1;
        start = i;
        ch = "\\";
      }
      if (ch === "\\")
        switch (json[i + 1]) {
          case "u":
            {
              str += json.slice(start, i);
              const code = json.substr(i + 2, 4);
              switch (code) {
                case "0000":
                  str += "\\0";
                  break;
                case "0007":
                  str += "\\a";
                  break;
                case "000b":
                  str += "\\v";
                  break;
                case "001b":
                  str += "\\e";
                  break;
                case "0085":
                  str += "\\N";
                  break;
                case "00a0":
                  str += "\\_";
                  break;
                case "2028":
                  str += "\\L";
                  break;
                case "2029":
                  str += "\\P";
                  break;
                default:
                  if (code.substr(0, 2) === "00")
                    str += "\\x" + code.substr(2);
                  else
                    str += json.substr(i, 6);
              }
              i += 5;
              start = i + 1;
            }
            break;
          case "n":
            if (implicitKey || json[i + 2] === '"' || json.length < minMultiLineLength) {
              i += 1;
            } else {
              str += json.slice(start, i) + `

`;
              while (json[i + 2] === "\\" && json[i + 3] === "n" && json[i + 4] !== '"') {
                str += `
`;
                i += 2;
              }
              str += indent;
              if (json[i + 2] === " ")
                str += "\\";
              i += 1;
              start = i + 1;
            }
            break;
          default:
            i += 1;
        }
    }
    str = start ? str + json.slice(start) : json;
    return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_QUOTED, getFoldOptions(ctx, false));
  }
  function singleQuotedString(value, ctx) {
    if (ctx.options.singleQuote === false || ctx.implicitKey && value.includes(`
`) || /[ \t]\n|\n[ \t]/.test(value))
      return doubleQuotedString(value, ctx);
    const indent = ctx.indent || (containsDocumentMarker(value) ? "  " : "");
    const res = "'" + value.replace(/'/g, "''").replace(/\n+/g, `$&
${indent}`) + "'";
    return ctx.implicitKey ? res : foldFlowLines.foldFlowLines(res, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function quotedString(value, ctx) {
    const { singleQuote } = ctx.options;
    let qs;
    if (singleQuote === false)
      qs = doubleQuotedString;
    else {
      const hasDouble = value.includes('"');
      const hasSingle = value.includes("'");
      if (hasDouble && !hasSingle)
        qs = singleQuotedString;
      else if (hasSingle && !hasDouble)
        qs = doubleQuotedString;
      else
        qs = singleQuote ? singleQuotedString : doubleQuotedString;
    }
    return qs(value, ctx);
  }
  var blockEndNewlines;
  try {
    blockEndNewlines = new RegExp(`(^|(?<!
))
+(?!
|$)`, "g");
  } catch {
    blockEndNewlines = /\n+(?!\n|$)/g;
  }
  function blockString({ comment, type, value }, ctx, onComment, onChompKeep) {
    const { blockQuote, commentString, lineWidth } = ctx.options;
    if (!blockQuote || /\n[\t ]+$/.test(value)) {
      return quotedString(value, ctx);
    }
    const indent = ctx.indent || (ctx.forceBlockIndent || containsDocumentMarker(value) ? "  " : "");
    const literal = blockQuote === "literal" ? true : blockQuote === "folded" || type === Scalar.Scalar.BLOCK_FOLDED ? false : type === Scalar.Scalar.BLOCK_LITERAL ? true : !lineLengthOverLimit(value, lineWidth, indent.length);
    if (!value)
      return literal ? `|
` : `>
`;
    let chomp;
    let endStart;
    for (endStart = value.length;endStart > 0; --endStart) {
      const ch = value[endStart - 1];
      if (ch !== `
` && ch !== "\t" && ch !== " ")
        break;
    }
    let end = value.substring(endStart);
    const endNlPos = end.indexOf(`
`);
    if (endNlPos === -1) {
      chomp = "-";
    } else if (value === end || endNlPos !== end.length - 1) {
      chomp = "+";
      if (onChompKeep)
        onChompKeep();
    } else {
      chomp = "";
    }
    if (end) {
      value = value.slice(0, -end.length);
      if (end[end.length - 1] === `
`)
        end = end.slice(0, -1);
      end = end.replace(blockEndNewlines, `$&${indent}`);
    }
    let startWithSpace = false;
    let startEnd;
    let startNlPos = -1;
    for (startEnd = 0;startEnd < value.length; ++startEnd) {
      const ch = value[startEnd];
      if (ch === " ")
        startWithSpace = true;
      else if (ch === `
`)
        startNlPos = startEnd;
      else
        break;
    }
    let start = value.substring(0, startNlPos < startEnd ? startNlPos + 1 : startEnd);
    if (start) {
      value = value.substring(start.length);
      start = start.replace(/\n+/g, `$&${indent}`);
    }
    const indentSize = indent ? "2" : "1";
    let header = (startWithSpace ? indentSize : "") + chomp;
    if (comment) {
      header += " " + commentString(comment.replace(/ ?[\r\n]+/g, " "));
      if (onComment)
        onComment();
    }
    if (!literal) {
      const foldedValue = value.replace(/\n+/g, `
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g, "$1$2").replace(/\n+/g, `$&${indent}`);
      let literalFallback = false;
      const foldOptions = getFoldOptions(ctx, true);
      if (blockQuote !== "folded" && type !== Scalar.Scalar.BLOCK_FOLDED) {
        foldOptions.onOverflow = () => {
          literalFallback = true;
        };
      }
      const body = foldFlowLines.foldFlowLines(`${start}${foldedValue}${end}`, indent, foldFlowLines.FOLD_BLOCK, foldOptions);
      if (!literalFallback)
        return `>${header}
${indent}${body}`;
    }
    value = value.replace(/\n+/g, `$&${indent}`);
    return `|${header}
${indent}${start}${value}${end}`;
  }
  function plainString(item, ctx, onComment, onChompKeep) {
    const { type, value } = item;
    const { actualString, implicitKey, indent, indentStep, inFlow } = ctx;
    if (implicitKey && value.includes(`
`) || inFlow && /[[\]{},]/.test(value)) {
      return quotedString(value, ctx);
    }
    if (/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(value)) {
      return implicitKey || inFlow || !value.includes(`
`) ? quotedString(value, ctx) : blockString(item, ctx, onComment, onChompKeep);
    }
    if (!implicitKey && !inFlow && type !== Scalar.Scalar.PLAIN && value.includes(`
`)) {
      return blockString(item, ctx, onComment, onChompKeep);
    }
    if (containsDocumentMarker(value)) {
      if (indent === "") {
        ctx.forceBlockIndent = true;
        return blockString(item, ctx, onComment, onChompKeep);
      } else if (implicitKey && indent === indentStep) {
        return quotedString(value, ctx);
      }
    }
    const str = value.replace(/\n+/g, `$&
${indent}`);
    if (actualString) {
      const test = (tag) => tag.default && tag.tag !== "tag:yaml.org,2002:str" && tag.test?.test(str);
      const { compat, tags } = ctx.doc.schema;
      if (tags.some(test) || compat?.some(test))
        return quotedString(value, ctx);
    }
    return implicitKey ? str : foldFlowLines.foldFlowLines(str, indent, foldFlowLines.FOLD_FLOW, getFoldOptions(ctx, false));
  }
  function stringifyString(item, ctx, onComment, onChompKeep) {
    const { implicitKey, inFlow } = ctx;
    const ss = typeof item.value === "string" ? item : Object.assign({}, item, { value: String(item.value) });
    let { type } = item;
    if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
      if (/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(ss.value))
        type = Scalar.Scalar.QUOTE_DOUBLE;
    }
    const _stringify = (_type) => {
      switch (_type) {
        case Scalar.Scalar.BLOCK_FOLDED:
        case Scalar.Scalar.BLOCK_LITERAL:
          return implicitKey || inFlow ? quotedString(ss.value, ctx) : blockString(ss, ctx, onComment, onChompKeep);
        case Scalar.Scalar.QUOTE_DOUBLE:
          return doubleQuotedString(ss.value, ctx);
        case Scalar.Scalar.QUOTE_SINGLE:
          return singleQuotedString(ss.value, ctx);
        case Scalar.Scalar.PLAIN:
          return plainString(ss, ctx, onComment, onChompKeep);
        default:
          return null;
      }
    };
    let res = _stringify(type);
    if (res === null) {
      const { defaultKeyType, defaultStringType } = ctx.options;
      const t = implicitKey && defaultKeyType || defaultStringType;
      res = _stringify(t);
      if (res === null)
        throw new Error(`Unsupported default string type ${t}`);
    }
    return res;
  }
  exports.stringifyString = stringifyString;
});

// node_modules/yaml/dist/stringify/stringify.js
var require_stringify = __commonJS((exports) => {
  var anchors = require_anchors();
  var identity = require_identity();
  var stringifyComment = require_stringifyComment();
  var stringifyString = require_stringifyString();
  function createStringifyContext(doc, options) {
    const opt = Object.assign({
      blockQuote: true,
      commentString: stringifyComment.stringifyComment,
      defaultKeyType: null,
      defaultStringType: "PLAIN",
      directives: null,
      doubleQuotedAsJSON: false,
      doubleQuotedMinMultiLineLength: 40,
      falseStr: "false",
      flowCollectionPadding: true,
      indentSeq: true,
      lineWidth: 80,
      minContentWidth: 20,
      nullStr: "null",
      simpleKeys: false,
      singleQuote: null,
      trueStr: "true",
      verifyAliasOrder: true
    }, doc.schema.toStringOptions, options);
    let inFlow;
    switch (opt.collectionStyle) {
      case "block":
        inFlow = false;
        break;
      case "flow":
        inFlow = true;
        break;
      default:
        inFlow = null;
    }
    return {
      anchors: new Set,
      doc,
      flowCollectionPadding: opt.flowCollectionPadding ? " " : "",
      indent: "",
      indentStep: typeof opt.indent === "number" ? " ".repeat(opt.indent) : "  ",
      inFlow,
      options: opt
    };
  }
  function getTagObject(tags, item) {
    if (item.tag) {
      const match = tags.filter((t) => t.tag === item.tag);
      if (match.length > 0)
        return match.find((t) => t.format === item.format) ?? match[0];
    }
    let tagObj = undefined;
    let obj;
    if (identity.isScalar(item)) {
      obj = item.value;
      let match = tags.filter((t) => t.identify?.(obj));
      if (match.length > 1) {
        const testMatch = match.filter((t) => t.test);
        if (testMatch.length > 0)
          match = testMatch;
      }
      tagObj = match.find((t) => t.format === item.format) ?? match.find((t) => !t.format);
    } else {
      obj = item;
      tagObj = tags.find((t) => t.nodeClass && obj instanceof t.nodeClass);
    }
    if (!tagObj) {
      const name = obj?.constructor?.name ?? (obj === null ? "null" : typeof obj);
      throw new Error(`Tag not resolved for ${name} value`);
    }
    return tagObj;
  }
  function stringifyProps(node, tagObj, { anchors: anchors$1, doc }) {
    if (!doc.directives)
      return "";
    const props = [];
    const anchor = (identity.isScalar(node) || identity.isCollection(node)) && node.anchor;
    if (anchor && anchors.anchorIsValid(anchor)) {
      anchors$1.add(anchor);
      props.push(`&${anchor}`);
    }
    const tag = node.tag ?? (tagObj.default ? null : tagObj.tag);
    if (tag)
      props.push(doc.directives.tagString(tag));
    return props.join(" ");
  }
  function stringify(item, ctx, onComment, onChompKeep) {
    if (identity.isPair(item))
      return item.toString(ctx, onComment, onChompKeep);
    if (identity.isAlias(item)) {
      if (ctx.doc.directives)
        return item.toString(ctx);
      if (ctx.resolvedAliases?.has(item)) {
        throw new TypeError(`Cannot stringify circular structure without alias nodes`);
      } else {
        if (ctx.resolvedAliases)
          ctx.resolvedAliases.add(item);
        else
          ctx.resolvedAliases = new Set([item]);
        item = item.resolve(ctx.doc);
      }
    }
    let tagObj = undefined;
    const node = identity.isNode(item) ? item : ctx.doc.createNode(item, { onTagObj: (o) => tagObj = o });
    tagObj ?? (tagObj = getTagObject(ctx.doc.schema.tags, node));
    const props = stringifyProps(node, tagObj, ctx);
    if (props.length > 0)
      ctx.indentAtStart = (ctx.indentAtStart ?? 0) + props.length + 1;
    const str = typeof tagObj.stringify === "function" ? tagObj.stringify(node, ctx, onComment, onChompKeep) : identity.isScalar(node) ? stringifyString.stringifyString(node, ctx, onComment, onChompKeep) : node.toString(ctx, onComment, onChompKeep);
    if (!props)
      return str;
    return identity.isScalar(node) || str[0] === "{" || str[0] === "[" ? `${props} ${str}` : `${props}
${ctx.indent}${str}`;
  }
  exports.createStringifyContext = createStringifyContext;
  exports.stringify = stringify;
});

// node_modules/yaml/dist/stringify/stringifyPair.js
var require_stringifyPair = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyPair({ key, value }, ctx, onComment, onChompKeep) {
    const { allNullValues, doc, indent, indentStep, options: { commentString, indentSeq, simpleKeys } } = ctx;
    let keyComment = identity.isNode(key) && key.comment || null;
    if (simpleKeys) {
      if (keyComment) {
        throw new Error("With simple keys, key nodes cannot have comments");
      }
      if (identity.isCollection(key) || !identity.isNode(key) && typeof key === "object") {
        const msg = "With simple keys, collection cannot be used as a key value";
        throw new Error(msg);
      }
    }
    let explicitKey = !simpleKeys && (!key || keyComment && value == null && !ctx.inFlow || identity.isCollection(key) || (identity.isScalar(key) ? key.type === Scalar.Scalar.BLOCK_FOLDED || key.type === Scalar.Scalar.BLOCK_LITERAL : typeof key === "object"));
    ctx = Object.assign({}, ctx, {
      allNullValues: false,
      implicitKey: !explicitKey && (simpleKeys || !allNullValues),
      indent: indent + indentStep
    });
    let keyCommentDone = false;
    let chompKeep = false;
    let str = stringify.stringify(key, ctx, () => keyCommentDone = true, () => chompKeep = true);
    if (!explicitKey && !ctx.inFlow && str.length > 1024) {
      if (simpleKeys)
        throw new Error("With simple keys, single line scalar must not span more than 1024 characters");
      explicitKey = true;
    }
    if (ctx.inFlow) {
      if (allNullValues || value == null) {
        if (keyCommentDone && onComment)
          onComment();
        return str === "" ? "?" : explicitKey ? `? ${str}` : str;
      }
    } else if (allNullValues && !simpleKeys || value == null && explicitKey) {
      str = `? ${str}`;
      if (keyComment && !keyCommentDone) {
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      } else if (chompKeep && onChompKeep)
        onChompKeep();
      return str;
    }
    if (keyCommentDone)
      keyComment = null;
    if (explicitKey) {
      if (keyComment)
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
      str = `? ${str}
${indent}:`;
    } else {
      str = `${str}:`;
      if (keyComment)
        str += stringifyComment.lineComment(str, ctx.indent, commentString(keyComment));
    }
    let vsb, vcb, valueComment;
    if (identity.isNode(value)) {
      vsb = !!value.spaceBefore;
      vcb = value.commentBefore;
      valueComment = value.comment;
    } else {
      vsb = false;
      vcb = null;
      valueComment = null;
      if (value && typeof value === "object")
        value = doc.createNode(value);
    }
    ctx.implicitKey = false;
    if (!explicitKey && !keyComment && identity.isScalar(value))
      ctx.indentAtStart = str.length + 1;
    chompKeep = false;
    if (!indentSeq && indentStep.length >= 2 && !ctx.inFlow && !explicitKey && identity.isSeq(value) && !value.flow && !value.tag && !value.anchor) {
      ctx.indent = ctx.indent.substring(2);
    }
    let valueCommentDone = false;
    const valueStr = stringify.stringify(value, ctx, () => valueCommentDone = true, () => chompKeep = true);
    let ws = " ";
    if (keyComment || vsb || vcb) {
      ws = vsb ? `
` : "";
      if (vcb) {
        const cs = commentString(vcb);
        ws += `
${stringifyComment.indentComment(cs, ctx.indent)}`;
      }
      if (valueStr === "" && !ctx.inFlow) {
        if (ws === `
` && valueComment)
          ws = `

`;
      } else {
        ws += `
${ctx.indent}`;
      }
    } else if (!explicitKey && identity.isCollection(value)) {
      const vs0 = valueStr[0];
      const nl0 = valueStr.indexOf(`
`);
      const hasNewline = nl0 !== -1;
      const flow = ctx.inFlow ?? value.flow ?? value.items.length === 0;
      if (hasNewline || !flow) {
        let hasPropsLine = false;
        if (hasNewline && (vs0 === "&" || vs0 === "!")) {
          let sp0 = valueStr.indexOf(" ");
          if (vs0 === "&" && sp0 !== -1 && sp0 < nl0 && valueStr[sp0 + 1] === "!") {
            sp0 = valueStr.indexOf(" ", sp0 + 1);
          }
          if (sp0 === -1 || nl0 < sp0)
            hasPropsLine = true;
        }
        if (!hasPropsLine)
          ws = `
${ctx.indent}`;
      }
    } else if (valueStr === "" || valueStr[0] === `
`) {
      ws = "";
    }
    str += ws + valueStr;
    if (ctx.inFlow) {
      if (valueCommentDone && onComment)
        onComment();
    } else if (valueComment && !valueCommentDone) {
      str += stringifyComment.lineComment(str, ctx.indent, commentString(valueComment));
    } else if (chompKeep && onChompKeep) {
      onChompKeep();
    }
    return str;
  }
  exports.stringifyPair = stringifyPair;
});

// node_modules/yaml/dist/log.js
var require_log = __commonJS((exports) => {
  var node_process = __require("process");
  function debug(logLevel, ...messages) {
    if (logLevel === "debug")
      console.log(...messages);
  }
  function warn(logLevel, warning) {
    if (logLevel === "debug" || logLevel === "warn") {
      if (typeof node_process.emitWarning === "function")
        node_process.emitWarning(warning);
      else
        console.warn(warning);
    }
  }
  exports.debug = debug;
  exports.warn = warn;
});

// node_modules/yaml/dist/schema/yaml-1.1/merge.js
var require_merge = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var MERGE_KEY = "<<";
  var merge = {
    identify: (value) => value === MERGE_KEY || typeof value === "symbol" && value.description === MERGE_KEY,
    default: "key",
    tag: "tag:yaml.org,2002:merge",
    test: /^<<$/,
    resolve: () => Object.assign(new Scalar.Scalar(Symbol(MERGE_KEY)), {
      addToJSMap: addMergeToJSMap
    }),
    stringify: () => MERGE_KEY
  };
  var isMergeKey = (ctx, key) => (merge.identify(key) || identity.isScalar(key) && (!key.type || key.type === Scalar.Scalar.PLAIN) && merge.identify(key.value)) && ctx?.doc.schema.tags.some((tag) => tag.tag === merge.tag && tag.default);
  function addMergeToJSMap(ctx, map, value) {
    value = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
    if (identity.isSeq(value))
      for (const it of value.items)
        mergeValue(ctx, map, it);
    else if (Array.isArray(value))
      for (const it of value)
        mergeValue(ctx, map, it);
    else
      mergeValue(ctx, map, value);
  }
  function mergeValue(ctx, map, value) {
    const source = ctx && identity.isAlias(value) ? value.resolve(ctx.doc) : value;
    if (!identity.isMap(source))
      throw new Error("Merge sources must be maps or map aliases");
    const srcMap = source.toJSON(null, ctx, Map);
    for (const [key, value2] of srcMap) {
      if (map instanceof Map) {
        if (!map.has(key))
          map.set(key, value2);
      } else if (map instanceof Set) {
        map.add(key);
      } else if (!Object.prototype.hasOwnProperty.call(map, key)) {
        Object.defineProperty(map, key, {
          value: value2,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
    }
    return map;
  }
  exports.addMergeToJSMap = addMergeToJSMap;
  exports.isMergeKey = isMergeKey;
  exports.merge = merge;
});

// node_modules/yaml/dist/nodes/addPairToJSMap.js
var require_addPairToJSMap = __commonJS((exports) => {
  var log = require_log();
  var merge = require_merge();
  var stringify = require_stringify();
  var identity = require_identity();
  var toJS = require_toJS();
  function addPairToJSMap(ctx, map, { key, value }) {
    if (identity.isNode(key) && key.addToJSMap)
      key.addToJSMap(ctx, map, value);
    else if (merge.isMergeKey(ctx, key))
      merge.addMergeToJSMap(ctx, map, value);
    else {
      const jsKey = toJS.toJS(key, "", ctx);
      if (map instanceof Map) {
        map.set(jsKey, toJS.toJS(value, jsKey, ctx));
      } else if (map instanceof Set) {
        map.add(jsKey);
      } else {
        const stringKey = stringifyKey(key, jsKey, ctx);
        const jsValue = toJS.toJS(value, stringKey, ctx);
        if (stringKey in map)
          Object.defineProperty(map, stringKey, {
            value: jsValue,
            writable: true,
            enumerable: true,
            configurable: true
          });
        else
          map[stringKey] = jsValue;
      }
    }
    return map;
  }
  function stringifyKey(key, jsKey, ctx) {
    if (jsKey === null)
      return "";
    if (typeof jsKey !== "object")
      return String(jsKey);
    if (identity.isNode(key) && ctx?.doc) {
      const strCtx = stringify.createStringifyContext(ctx.doc, {});
      strCtx.anchors = new Set;
      for (const node of ctx.anchors.keys())
        strCtx.anchors.add(node.anchor);
      strCtx.inFlow = true;
      strCtx.inStringifyKey = true;
      const strKey = key.toString(strCtx);
      if (!ctx.mapKeyWarned) {
        let jsonStr = JSON.stringify(strKey);
        if (jsonStr.length > 40)
          jsonStr = jsonStr.substring(0, 36) + '..."';
        log.warn(ctx.doc.options.logLevel, `Keys with collection values will be stringified due to JS Object restrictions: ${jsonStr}. Set mapAsMap: true to use object keys.`);
        ctx.mapKeyWarned = true;
      }
      return strKey;
    }
    return JSON.stringify(jsKey);
  }
  exports.addPairToJSMap = addPairToJSMap;
});

// node_modules/yaml/dist/nodes/Pair.js
var require_Pair = __commonJS((exports) => {
  var createNode = require_createNode();
  var stringifyPair = require_stringifyPair();
  var addPairToJSMap = require_addPairToJSMap();
  var identity = require_identity();
  function createPair(key, value, ctx) {
    const k = createNode.createNode(key, undefined, ctx);
    const v = createNode.createNode(value, undefined, ctx);
    return new Pair(k, v);
  }

  class Pair {
    constructor(key, value = null) {
      Object.defineProperty(this, identity.NODE_TYPE, { value: identity.PAIR });
      this.key = key;
      this.value = value;
    }
    clone(schema) {
      let { key, value } = this;
      if (identity.isNode(key))
        key = key.clone(schema);
      if (identity.isNode(value))
        value = value.clone(schema);
      return new Pair(key, value);
    }
    toJSON(_, ctx) {
      const pair = ctx?.mapAsMap ? new Map : {};
      return addPairToJSMap.addPairToJSMap(ctx, pair, this);
    }
    toString(ctx, onComment, onChompKeep) {
      return ctx?.doc ? stringifyPair.stringifyPair(this, ctx, onComment, onChompKeep) : JSON.stringify(this);
    }
  }
  exports.Pair = Pair;
  exports.createPair = createPair;
});

// node_modules/yaml/dist/stringify/stringifyCollection.js
var require_stringifyCollection = __commonJS((exports) => {
  var identity = require_identity();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyCollection(collection, ctx, options) {
    const flow = ctx.inFlow ?? collection.flow;
    const stringify2 = flow ? stringifyFlowCollection : stringifyBlockCollection;
    return stringify2(collection, ctx, options);
  }
  function stringifyBlockCollection({ comment, items }, ctx, { blockItemPrefix, flowChars, itemIndent, onChompKeep, onComment }) {
    const { indent, options: { commentString } } = ctx;
    const itemCtx = Object.assign({}, ctx, { indent: itemIndent, type: null });
    let chompKeep = false;
    const lines = [];
    for (let i = 0;i < items.length; ++i) {
      const item = items[i];
      let comment2 = null;
      if (identity.isNode(item)) {
        if (!chompKeep && item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, chompKeep);
        if (item.comment)
          comment2 = item.comment;
      } else if (identity.isPair(item)) {
        const ik = identity.isNode(item.key) ? item.key : null;
        if (ik) {
          if (!chompKeep && ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, chompKeep);
        }
      }
      chompKeep = false;
      let str2 = stringify.stringify(item, itemCtx, () => comment2 = null, () => chompKeep = true);
      if (comment2)
        str2 += stringifyComment.lineComment(str2, itemIndent, commentString(comment2));
      if (chompKeep && comment2)
        chompKeep = false;
      lines.push(blockItemPrefix + str2);
    }
    let str;
    if (lines.length === 0) {
      str = flowChars.start + flowChars.end;
    } else {
      str = lines[0];
      for (let i = 1;i < lines.length; ++i) {
        const line = lines[i];
        str += line ? `
${indent}${line}` : `
`;
      }
    }
    if (comment) {
      str += `
` + stringifyComment.indentComment(commentString(comment), indent);
      if (onComment)
        onComment();
    } else if (chompKeep && onChompKeep)
      onChompKeep();
    return str;
  }
  function stringifyFlowCollection({ items }, ctx, { flowChars, itemIndent }) {
    const { indent, indentStep, flowCollectionPadding: fcPadding, options: { commentString } } = ctx;
    itemIndent += indentStep;
    const itemCtx = Object.assign({}, ctx, {
      indent: itemIndent,
      inFlow: true,
      type: null
    });
    let reqNewline = false;
    let linesAtValue = 0;
    const lines = [];
    for (let i = 0;i < items.length; ++i) {
      const item = items[i];
      let comment = null;
      if (identity.isNode(item)) {
        if (item.spaceBefore)
          lines.push("");
        addCommentBefore(ctx, lines, item.commentBefore, false);
        if (item.comment)
          comment = item.comment;
      } else if (identity.isPair(item)) {
        const ik = identity.isNode(item.key) ? item.key : null;
        if (ik) {
          if (ik.spaceBefore)
            lines.push("");
          addCommentBefore(ctx, lines, ik.commentBefore, false);
          if (ik.comment)
            reqNewline = true;
        }
        const iv = identity.isNode(item.value) ? item.value : null;
        if (iv) {
          if (iv.comment)
            comment = iv.comment;
          if (iv.commentBefore)
            reqNewline = true;
        } else if (item.value == null && ik?.comment) {
          comment = ik.comment;
        }
      }
      if (comment)
        reqNewline = true;
      let str = stringify.stringify(item, itemCtx, () => comment = null);
      if (i < items.length - 1)
        str += ",";
      if (comment)
        str += stringifyComment.lineComment(str, itemIndent, commentString(comment));
      if (!reqNewline && (lines.length > linesAtValue || str.includes(`
`)))
        reqNewline = true;
      lines.push(str);
      linesAtValue = lines.length;
    }
    const { start, end } = flowChars;
    if (lines.length === 0) {
      return start + end;
    } else {
      if (!reqNewline) {
        const len = lines.reduce((sum, line) => sum + line.length + 2, 2);
        reqNewline = ctx.options.lineWidth > 0 && len > ctx.options.lineWidth;
      }
      if (reqNewline) {
        let str = start;
        for (const line of lines)
          str += line ? `
${indentStep}${indent}${line}` : `
`;
        return `${str}
${indent}${end}`;
      } else {
        return `${start}${fcPadding}${lines.join(" ")}${fcPadding}${end}`;
      }
    }
  }
  function addCommentBefore({ indent, options: { commentString } }, lines, comment, chompKeep) {
    if (comment && chompKeep)
      comment = comment.replace(/^\n+/, "");
    if (comment) {
      const ic = stringifyComment.indentComment(commentString(comment), indent);
      lines.push(ic.trimStart());
    }
  }
  exports.stringifyCollection = stringifyCollection;
});

// node_modules/yaml/dist/nodes/YAMLMap.js
var require_YAMLMap = __commonJS((exports) => {
  var stringifyCollection = require_stringifyCollection();
  var addPairToJSMap = require_addPairToJSMap();
  var Collection = require_Collection();
  var identity = require_identity();
  var Pair = require_Pair();
  var Scalar = require_Scalar();
  function findPair(items, key) {
    const k = identity.isScalar(key) ? key.value : key;
    for (const it of items) {
      if (identity.isPair(it)) {
        if (it.key === key || it.key === k)
          return it;
        if (identity.isScalar(it.key) && it.key.value === k)
          return it;
      }
    }
    return;
  }

  class YAMLMap extends Collection.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:map";
    }
    constructor(schema) {
      super(identity.MAP, schema);
      this.items = [];
    }
    static from(schema, obj, ctx) {
      const { keepUndefined, replacer } = ctx;
      const map = new this(schema);
      const add = (key, value) => {
        if (typeof replacer === "function")
          value = replacer.call(obj, key, value);
        else if (Array.isArray(replacer) && !replacer.includes(key))
          return;
        if (value !== undefined || keepUndefined)
          map.items.push(Pair.createPair(key, value, ctx));
      };
      if (obj instanceof Map) {
        for (const [key, value] of obj)
          add(key, value);
      } else if (obj && typeof obj === "object") {
        for (const key of Object.keys(obj))
          add(key, obj[key]);
      }
      if (typeof schema.sortMapEntries === "function") {
        map.items.sort(schema.sortMapEntries);
      }
      return map;
    }
    add(pair, overwrite) {
      let _pair;
      if (identity.isPair(pair))
        _pair = pair;
      else if (!pair || typeof pair !== "object" || !("key" in pair)) {
        _pair = new Pair.Pair(pair, pair?.value);
      } else
        _pair = new Pair.Pair(pair.key, pair.value);
      const prev = findPair(this.items, _pair.key);
      const sortEntries = this.schema?.sortMapEntries;
      if (prev) {
        if (!overwrite)
          throw new Error(`Key ${_pair.key} already set`);
        if (identity.isScalar(prev.value) && Scalar.isScalarValue(_pair.value))
          prev.value.value = _pair.value;
        else
          prev.value = _pair.value;
      } else if (sortEntries) {
        const i = this.items.findIndex((item) => sortEntries(_pair, item) < 0);
        if (i === -1)
          this.items.push(_pair);
        else
          this.items.splice(i, 0, _pair);
      } else {
        this.items.push(_pair);
      }
    }
    delete(key) {
      const it = findPair(this.items, key);
      if (!it)
        return false;
      const del = this.items.splice(this.items.indexOf(it), 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const it = findPair(this.items, key);
      const node = it?.value;
      return (!keepScalar && identity.isScalar(node) ? node.value : node) ?? undefined;
    }
    has(key) {
      return !!findPair(this.items, key);
    }
    set(key, value) {
      this.add(new Pair.Pair(key, value), true);
    }
    toJSON(_, ctx, Type) {
      const map = Type ? new Type : ctx?.mapAsMap ? new Map : {};
      if (ctx?.onCreate)
        ctx.onCreate(map);
      for (const item of this.items)
        addPairToJSMap.addPairToJSMap(ctx, map, item);
      return map;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      for (const item of this.items) {
        if (!identity.isPair(item))
          throw new Error(`Map items must all be pairs; found ${JSON.stringify(item)} instead`);
      }
      if (!ctx.allNullValues && this.hasAllNullValues(false))
        ctx = Object.assign({}, ctx, { allNullValues: true });
      return stringifyCollection.stringifyCollection(this, ctx, {
        blockItemPrefix: "",
        flowChars: { start: "{", end: "}" },
        itemIndent: ctx.indent || "",
        onChompKeep,
        onComment
      });
    }
  }
  exports.YAMLMap = YAMLMap;
  exports.findPair = findPair;
});

// node_modules/yaml/dist/schema/common/map.js
var require_map = __commonJS((exports) => {
  var identity = require_identity();
  var YAMLMap = require_YAMLMap();
  var map = {
    collection: "map",
    default: true,
    nodeClass: YAMLMap.YAMLMap,
    tag: "tag:yaml.org,2002:map",
    resolve(map2, onError) {
      if (!identity.isMap(map2))
        onError("Expected a mapping for this tag");
      return map2;
    },
    createNode: (schema, obj, ctx) => YAMLMap.YAMLMap.from(schema, obj, ctx)
  };
  exports.map = map;
});

// node_modules/yaml/dist/nodes/YAMLSeq.js
var require_YAMLSeq = __commonJS((exports) => {
  var createNode = require_createNode();
  var stringifyCollection = require_stringifyCollection();
  var Collection = require_Collection();
  var identity = require_identity();
  var Scalar = require_Scalar();
  var toJS = require_toJS();

  class YAMLSeq extends Collection.Collection {
    static get tagName() {
      return "tag:yaml.org,2002:seq";
    }
    constructor(schema) {
      super(identity.SEQ, schema);
      this.items = [];
    }
    add(value) {
      this.items.push(value);
    }
    delete(key) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return false;
      const del = this.items.splice(idx, 1);
      return del.length > 0;
    }
    get(key, keepScalar) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        return;
      const it = this.items[idx];
      return !keepScalar && identity.isScalar(it) ? it.value : it;
    }
    has(key) {
      const idx = asItemIndex(key);
      return typeof idx === "number" && idx < this.items.length;
    }
    set(key, value) {
      const idx = asItemIndex(key);
      if (typeof idx !== "number")
        throw new Error(`Expected a valid index, not ${key}.`);
      const prev = this.items[idx];
      if (identity.isScalar(prev) && Scalar.isScalarValue(value))
        prev.value = value;
      else
        this.items[idx] = value;
    }
    toJSON(_, ctx) {
      const seq = [];
      if (ctx?.onCreate)
        ctx.onCreate(seq);
      let i = 0;
      for (const item of this.items)
        seq.push(toJS.toJS(item, String(i++), ctx));
      return seq;
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      return stringifyCollection.stringifyCollection(this, ctx, {
        blockItemPrefix: "- ",
        flowChars: { start: "[", end: "]" },
        itemIndent: (ctx.indent || "") + "  ",
        onChompKeep,
        onComment
      });
    }
    static from(schema, obj, ctx) {
      const { replacer } = ctx;
      const seq = new this(schema);
      if (obj && Symbol.iterator in Object(obj)) {
        let i = 0;
        for (let it of obj) {
          if (typeof replacer === "function") {
            const key = obj instanceof Set ? it : String(i++);
            it = replacer.call(obj, key, it);
          }
          seq.items.push(createNode.createNode(it, undefined, ctx));
        }
      }
      return seq;
    }
  }
  function asItemIndex(key) {
    let idx = identity.isScalar(key) ? key.value : key;
    if (idx && typeof idx === "string")
      idx = Number(idx);
    return typeof idx === "number" && Number.isInteger(idx) && idx >= 0 ? idx : null;
  }
  exports.YAMLSeq = YAMLSeq;
});

// node_modules/yaml/dist/schema/common/seq.js
var require_seq = __commonJS((exports) => {
  var identity = require_identity();
  var YAMLSeq = require_YAMLSeq();
  var seq = {
    collection: "seq",
    default: true,
    nodeClass: YAMLSeq.YAMLSeq,
    tag: "tag:yaml.org,2002:seq",
    resolve(seq2, onError) {
      if (!identity.isSeq(seq2))
        onError("Expected a sequence for this tag");
      return seq2;
    },
    createNode: (schema, obj, ctx) => YAMLSeq.YAMLSeq.from(schema, obj, ctx)
  };
  exports.seq = seq;
});

// node_modules/yaml/dist/schema/common/string.js
var require_string = __commonJS((exports) => {
  var stringifyString = require_stringifyString();
  var string = {
    identify: (value) => typeof value === "string",
    default: true,
    tag: "tag:yaml.org,2002:str",
    resolve: (str) => str,
    stringify(item, ctx, onComment, onChompKeep) {
      ctx = Object.assign({ actualString: true }, ctx);
      return stringifyString.stringifyString(item, ctx, onComment, onChompKeep);
    }
  };
  exports.string = string;
});

// node_modules/yaml/dist/schema/common/null.js
var require_null = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var nullTag = {
    identify: (value) => value == null,
    createNode: () => new Scalar.Scalar(null),
    default: true,
    tag: "tag:yaml.org,2002:null",
    test: /^(?:~|[Nn]ull|NULL)?$/,
    resolve: () => new Scalar.Scalar(null),
    stringify: ({ source }, ctx) => typeof source === "string" && nullTag.test.test(source) ? source : ctx.options.nullStr
  };
  exports.nullTag = nullTag;
});

// node_modules/yaml/dist/schema/core/bool.js
var require_bool = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var boolTag = {
    identify: (value) => typeof value === "boolean",
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,
    resolve: (str) => new Scalar.Scalar(str[0] === "t" || str[0] === "T"),
    stringify({ source, value }, ctx) {
      if (source && boolTag.test.test(source)) {
        const sv = source[0] === "t" || source[0] === "T";
        if (value === sv)
          return source;
      }
      return value ? ctx.options.trueStr : ctx.options.falseStr;
    }
  };
  exports.boolTag = boolTag;
});

// node_modules/yaml/dist/stringify/stringifyNumber.js
var require_stringifyNumber = __commonJS((exports) => {
  function stringifyNumber({ format, minFractionDigits, tag, value }) {
    if (typeof value === "bigint")
      return String(value);
    const num = typeof value === "number" ? value : Number(value);
    if (!isFinite(num))
      return isNaN(num) ? ".nan" : num < 0 ? "-.inf" : ".inf";
    let n = Object.is(value, -0) ? "-0" : JSON.stringify(value);
    if (!format && minFractionDigits && (!tag || tag === "tag:yaml.org,2002:float") && /^\d/.test(n)) {
      let i = n.indexOf(".");
      if (i < 0) {
        i = n.length;
        n += ".";
      }
      let d = minFractionDigits - (n.length - i - 1);
      while (d-- > 0)
        n += "0";
    }
    return n;
  }
  exports.stringifyNumber = stringifyNumber;
});

// node_modules/yaml/dist/schema/core/float.js
var require_float = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var stringifyNumber = require_stringifyNumber();
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,
    resolve(str) {
      const node = new Scalar.Scalar(parseFloat(str));
      const dot = str.indexOf(".");
      if (dot !== -1 && str[str.length - 1] === "0")
        node.minFractionDigits = str.length - dot - 1;
      return node;
    },
    stringify: stringifyNumber.stringifyNumber
  };
  exports.float = float;
  exports.floatExp = floatExp;
  exports.floatNaN = floatNaN;
});

// node_modules/yaml/dist/schema/core/int.js
var require_int = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  var intResolve = (str, offset, radix, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str.substring(offset), radix);
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value) && value >= 0)
      return prefix + value.toString(radix);
    return stringifyNumber.stringifyNumber(node);
  }
  var intOct = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^0o[0-7]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 8, opt),
    stringify: (node) => intStringify(node, 8, "0o")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
  };
  var intHex = {
    identify: (value) => intIdentify(value) && value >= 0,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^0x[0-9a-fA-F]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  exports.int = int;
  exports.intHex = intHex;
  exports.intOct = intOct;
});

// node_modules/yaml/dist/schema/core/schema.js
var require_schema = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var bool = require_bool();
  var float = require_float();
  var int = require_int();
  var schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.boolTag,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float
  ];
  exports.schema = schema;
});

// node_modules/yaml/dist/schema/json/schema.js
var require_schema2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var map = require_map();
  var seq = require_seq();
  function intIdentify(value) {
    return typeof value === "bigint" || Number.isInteger(value);
  }
  var stringifyJSON = ({ value }) => JSON.stringify(value);
  var jsonScalars = [
    {
      identify: (value) => typeof value === "string",
      default: true,
      tag: "tag:yaml.org,2002:str",
      resolve: (str) => str,
      stringify: stringifyJSON
    },
    {
      identify: (value) => value == null,
      createNode: () => new Scalar.Scalar(null),
      default: true,
      tag: "tag:yaml.org,2002:null",
      test: /^null$/,
      resolve: () => null,
      stringify: stringifyJSON
    },
    {
      identify: (value) => typeof value === "boolean",
      default: true,
      tag: "tag:yaml.org,2002:bool",
      test: /^true$|^false$/,
      resolve: (str) => str === "true",
      stringify: stringifyJSON
    },
    {
      identify: intIdentify,
      default: true,
      tag: "tag:yaml.org,2002:int",
      test: /^-?(?:0|[1-9][0-9]*)$/,
      resolve: (str, _onError, { intAsBigInt }) => intAsBigInt ? BigInt(str) : parseInt(str, 10),
      stringify: ({ value }) => intIdentify(value) ? value.toString() : JSON.stringify(value)
    },
    {
      identify: (value) => typeof value === "number",
      default: true,
      tag: "tag:yaml.org,2002:float",
      test: /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,
      resolve: (str) => parseFloat(str),
      stringify: stringifyJSON
    }
  ];
  var jsonError = {
    default: true,
    tag: "",
    test: /^/,
    resolve(str, onError) {
      onError(`Unresolved plain scalar ${JSON.stringify(str)}`);
      return str;
    }
  };
  var schema = [map.map, seq.seq].concat(jsonScalars, jsonError);
  exports.schema = schema;
});

// node_modules/yaml/dist/schema/yaml-1.1/binary.js
var require_binary = __commonJS((exports) => {
  var node_buffer = __require("buffer");
  var Scalar = require_Scalar();
  var stringifyString = require_stringifyString();
  var binary = {
    identify: (value) => value instanceof Uint8Array,
    default: false,
    tag: "tag:yaml.org,2002:binary",
    resolve(src, onError) {
      if (typeof node_buffer.Buffer === "function") {
        return node_buffer.Buffer.from(src, "base64");
      } else if (typeof atob === "function") {
        const str = atob(src.replace(/[\n\r]/g, ""));
        const buffer = new Uint8Array(str.length);
        for (let i = 0;i < str.length; ++i)
          buffer[i] = str.charCodeAt(i);
        return buffer;
      } else {
        onError("This environment does not support reading binary tags; either Buffer or atob is required");
        return src;
      }
    },
    stringify({ comment, type, value }, ctx, onComment, onChompKeep) {
      if (!value)
        return "";
      const buf = value;
      let str;
      if (typeof node_buffer.Buffer === "function") {
        str = buf instanceof node_buffer.Buffer ? buf.toString("base64") : node_buffer.Buffer.from(buf.buffer).toString("base64");
      } else if (typeof btoa === "function") {
        let s = "";
        for (let i = 0;i < buf.length; ++i)
          s += String.fromCharCode(buf[i]);
        str = btoa(s);
      } else {
        throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");
      }
      type ?? (type = Scalar.Scalar.BLOCK_LITERAL);
      if (type !== Scalar.Scalar.QUOTE_DOUBLE) {
        const lineWidth = Math.max(ctx.options.lineWidth - ctx.indent.length, ctx.options.minContentWidth);
        const n = Math.ceil(str.length / lineWidth);
        const lines = new Array(n);
        for (let i = 0, o = 0;i < n; ++i, o += lineWidth) {
          lines[i] = str.substr(o, lineWidth);
        }
        str = lines.join(type === Scalar.Scalar.BLOCK_LITERAL ? `
` : " ");
      }
      return stringifyString.stringifyString({ comment, type, value: str }, ctx, onComment, onChompKeep);
    }
  };
  exports.binary = binary;
});

// node_modules/yaml/dist/schema/yaml-1.1/pairs.js
var require_pairs = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var Scalar = require_Scalar();
  var YAMLSeq = require_YAMLSeq();
  function resolvePairs(seq, onError) {
    if (identity.isSeq(seq)) {
      for (let i = 0;i < seq.items.length; ++i) {
        let item = seq.items[i];
        if (identity.isPair(item))
          continue;
        else if (identity.isMap(item)) {
          if (item.items.length > 1)
            onError("Each pair must have its own sequence indicator");
          const pair = item.items[0] || new Pair.Pair(new Scalar.Scalar(null));
          if (item.commentBefore)
            pair.key.commentBefore = pair.key.commentBefore ? `${item.commentBefore}
${pair.key.commentBefore}` : item.commentBefore;
          if (item.comment) {
            const cn = pair.value ?? pair.key;
            cn.comment = cn.comment ? `${item.comment}
${cn.comment}` : item.comment;
          }
          item = pair;
        }
        seq.items[i] = identity.isPair(item) ? item : new Pair.Pair(item);
      }
    } else
      onError("Expected a sequence for this tag");
    return seq;
  }
  function createPairs(schema, iterable, ctx) {
    const { replacer } = ctx;
    const pairs2 = new YAMLSeq.YAMLSeq(schema);
    pairs2.tag = "tag:yaml.org,2002:pairs";
    let i = 0;
    if (iterable && Symbol.iterator in Object(iterable))
      for (let it of iterable) {
        if (typeof replacer === "function")
          it = replacer.call(iterable, String(i++), it);
        let key, value;
        if (Array.isArray(it)) {
          if (it.length === 2) {
            key = it[0];
            value = it[1];
          } else
            throw new TypeError(`Expected [key, value] tuple: ${it}`);
        } else if (it && it instanceof Object) {
          const keys = Object.keys(it);
          if (keys.length === 1) {
            key = keys[0];
            value = it[key];
          } else {
            throw new TypeError(`Expected tuple with one key, not ${keys.length} keys`);
          }
        } else {
          key = it;
        }
        pairs2.items.push(Pair.createPair(key, value, ctx));
      }
    return pairs2;
  }
  var pairs = {
    collection: "seq",
    default: false,
    tag: "tag:yaml.org,2002:pairs",
    resolve: resolvePairs,
    createNode: createPairs
  };
  exports.createPairs = createPairs;
  exports.pairs = pairs;
  exports.resolvePairs = resolvePairs;
});

// node_modules/yaml/dist/schema/yaml-1.1/omap.js
var require_omap = __commonJS((exports) => {
  var identity = require_identity();
  var toJS = require_toJS();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var pairs = require_pairs();

  class YAMLOMap extends YAMLSeq.YAMLSeq {
    constructor() {
      super();
      this.add = YAMLMap.YAMLMap.prototype.add.bind(this);
      this.delete = YAMLMap.YAMLMap.prototype.delete.bind(this);
      this.get = YAMLMap.YAMLMap.prototype.get.bind(this);
      this.has = YAMLMap.YAMLMap.prototype.has.bind(this);
      this.set = YAMLMap.YAMLMap.prototype.set.bind(this);
      this.tag = YAMLOMap.tag;
    }
    toJSON(_, ctx) {
      if (!ctx)
        return super.toJSON(_);
      const map = new Map;
      if (ctx?.onCreate)
        ctx.onCreate(map);
      for (const pair of this.items) {
        let key, value;
        if (identity.isPair(pair)) {
          key = toJS.toJS(pair.key, "", ctx);
          value = toJS.toJS(pair.value, key, ctx);
        } else {
          key = toJS.toJS(pair, "", ctx);
        }
        if (map.has(key))
          throw new Error("Ordered maps must not include duplicate keys");
        map.set(key, value);
      }
      return map;
    }
    static from(schema, iterable, ctx) {
      const pairs$1 = pairs.createPairs(schema, iterable, ctx);
      const omap2 = new this;
      omap2.items = pairs$1.items;
      return omap2;
    }
  }
  YAMLOMap.tag = "tag:yaml.org,2002:omap";
  var omap = {
    collection: "seq",
    identify: (value) => value instanceof Map,
    nodeClass: YAMLOMap,
    default: false,
    tag: "tag:yaml.org,2002:omap",
    resolve(seq, onError) {
      const pairs$1 = pairs.resolvePairs(seq, onError);
      const seenKeys = [];
      for (const { key } of pairs$1.items) {
        if (identity.isScalar(key)) {
          if (seenKeys.includes(key.value)) {
            onError(`Ordered maps must not include duplicate keys: ${key.value}`);
          } else {
            seenKeys.push(key.value);
          }
        }
      }
      return Object.assign(new YAMLOMap, pairs$1);
    },
    createNode: (schema, iterable, ctx) => YAMLOMap.from(schema, iterable, ctx)
  };
  exports.YAMLOMap = YAMLOMap;
  exports.omap = omap;
});

// node_modules/yaml/dist/schema/yaml-1.1/bool.js
var require_bool2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  function boolStringify({ value, source }, ctx) {
    const boolObj = value ? trueTag : falseTag;
    if (source && boolObj.test.test(source))
      return source;
    return value ? ctx.options.trueStr : ctx.options.falseStr;
  }
  var trueTag = {
    identify: (value) => value === true,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,
    resolve: () => new Scalar.Scalar(true),
    stringify: boolStringify
  };
  var falseTag = {
    identify: (value) => value === false,
    default: true,
    tag: "tag:yaml.org,2002:bool",
    test: /^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,
    resolve: () => new Scalar.Scalar(false),
    stringify: boolStringify
  };
  exports.falseTag = falseTag;
  exports.trueTag = trueTag;
});

// node_modules/yaml/dist/schema/yaml-1.1/float.js
var require_float2 = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var stringifyNumber = require_stringifyNumber();
  var floatNaN = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,
    resolve: (str) => str.slice(-3).toLowerCase() === "nan" ? NaN : str[0] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
    stringify: stringifyNumber.stringifyNumber
  };
  var floatExp = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "EXP",
    test: /^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,
    resolve: (str) => parseFloat(str.replace(/_/g, "")),
    stringify(node) {
      const num = Number(node.value);
      return isFinite(num) ? num.toExponential() : stringifyNumber.stringifyNumber(node);
    }
  };
  var float = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    test: /^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,
    resolve(str) {
      const node = new Scalar.Scalar(parseFloat(str.replace(/_/g, "")));
      const dot = str.indexOf(".");
      if (dot !== -1) {
        const f = str.substring(dot + 1).replace(/_/g, "");
        if (f[f.length - 1] === "0")
          node.minFractionDigits = f.length;
      }
      return node;
    },
    stringify: stringifyNumber.stringifyNumber
  };
  exports.float = float;
  exports.floatExp = floatExp;
  exports.floatNaN = floatNaN;
});

// node_modules/yaml/dist/schema/yaml-1.1/int.js
var require_int2 = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  var intIdentify = (value) => typeof value === "bigint" || Number.isInteger(value);
  function intResolve(str, offset, radix, { intAsBigInt }) {
    const sign = str[0];
    if (sign === "-" || sign === "+")
      offset += 1;
    str = str.substring(offset).replace(/_/g, "");
    if (intAsBigInt) {
      switch (radix) {
        case 2:
          str = `0b${str}`;
          break;
        case 8:
          str = `0o${str}`;
          break;
        case 16:
          str = `0x${str}`;
          break;
      }
      const n2 = BigInt(str);
      return sign === "-" ? BigInt(-1) * n2 : n2;
    }
    const n = parseInt(str, radix);
    return sign === "-" ? -1 * n : n;
  }
  function intStringify(node, radix, prefix) {
    const { value } = node;
    if (intIdentify(value)) {
      const str = value.toString(radix);
      return value < 0 ? "-" + prefix + str.substr(1) : prefix + str;
    }
    return stringifyNumber.stringifyNumber(node);
  }
  var intBin = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "BIN",
    test: /^[-+]?0b[0-1_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 2, opt),
    stringify: (node) => intStringify(node, 2, "0b")
  };
  var intOct = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "OCT",
    test: /^[-+]?0[0-7_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 1, 8, opt),
    stringify: (node) => intStringify(node, 8, "0")
  };
  var int = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    test: /^[-+]?[0-9][0-9_]*$/,
    resolve: (str, _onError, opt) => intResolve(str, 0, 10, opt),
    stringify: stringifyNumber.stringifyNumber
  };
  var intHex = {
    identify: intIdentify,
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "HEX",
    test: /^[-+]?0x[0-9a-fA-F_]+$/,
    resolve: (str, _onError, opt) => intResolve(str, 2, 16, opt),
    stringify: (node) => intStringify(node, 16, "0x")
  };
  exports.int = int;
  exports.intBin = intBin;
  exports.intHex = intHex;
  exports.intOct = intOct;
});

// node_modules/yaml/dist/schema/yaml-1.1/set.js
var require_set = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();

  class YAMLSet extends YAMLMap.YAMLMap {
    constructor(schema) {
      super(schema);
      this.tag = YAMLSet.tag;
    }
    add(key) {
      let pair;
      if (identity.isPair(key))
        pair = key;
      else if (key && typeof key === "object" && "key" in key && "value" in key && key.value === null)
        pair = new Pair.Pair(key.key, null);
      else
        pair = new Pair.Pair(key, null);
      const prev = YAMLMap.findPair(this.items, pair.key);
      if (!prev)
        this.items.push(pair);
    }
    get(key, keepPair) {
      const pair = YAMLMap.findPair(this.items, key);
      return !keepPair && identity.isPair(pair) ? identity.isScalar(pair.key) ? pair.key.value : pair.key : pair;
    }
    set(key, value) {
      if (typeof value !== "boolean")
        throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof value}`);
      const prev = YAMLMap.findPair(this.items, key);
      if (prev && !value) {
        this.items.splice(this.items.indexOf(prev), 1);
      } else if (!prev && value) {
        this.items.push(new Pair.Pair(key));
      }
    }
    toJSON(_, ctx) {
      return super.toJSON(_, ctx, Set);
    }
    toString(ctx, onComment, onChompKeep) {
      if (!ctx)
        return JSON.stringify(this);
      if (this.hasAllNullValues(true))
        return super.toString(Object.assign({}, ctx, { allNullValues: true }), onComment, onChompKeep);
      else
        throw new Error("Set items must all have null values");
    }
    static from(schema, iterable, ctx) {
      const { replacer } = ctx;
      const set2 = new this(schema);
      if (iterable && Symbol.iterator in Object(iterable))
        for (let value of iterable) {
          if (typeof replacer === "function")
            value = replacer.call(iterable, value, value);
          set2.items.push(Pair.createPair(value, null, ctx));
        }
      return set2;
    }
  }
  YAMLSet.tag = "tag:yaml.org,2002:set";
  var set = {
    collection: "map",
    identify: (value) => value instanceof Set,
    nodeClass: YAMLSet,
    default: false,
    tag: "tag:yaml.org,2002:set",
    createNode: (schema, iterable, ctx) => YAMLSet.from(schema, iterable, ctx),
    resolve(map, onError) {
      if (identity.isMap(map)) {
        if (map.hasAllNullValues(true))
          return Object.assign(new YAMLSet, map);
        else
          onError("Set items must all have null values");
      } else
        onError("Expected a mapping for this tag");
      return map;
    }
  };
  exports.YAMLSet = YAMLSet;
  exports.set = set;
});

// node_modules/yaml/dist/schema/yaml-1.1/timestamp.js
var require_timestamp = __commonJS((exports) => {
  var stringifyNumber = require_stringifyNumber();
  function parseSexagesimal(str, asBigInt) {
    const sign = str[0];
    const parts = sign === "-" || sign === "+" ? str.substring(1) : str;
    const num = (n) => asBigInt ? BigInt(n) : Number(n);
    const res = parts.replace(/_/g, "").split(":").reduce((res2, p) => res2 * num(60) + num(p), num(0));
    return sign === "-" ? num(-1) * res : res;
  }
  function stringifySexagesimal(node) {
    let { value } = node;
    let num = (n) => n;
    if (typeof value === "bigint")
      num = (n) => BigInt(n);
    else if (isNaN(value) || !isFinite(value))
      return stringifyNumber.stringifyNumber(node);
    let sign = "";
    if (value < 0) {
      sign = "-";
      value *= num(-1);
    }
    const _60 = num(60);
    const parts = [value % _60];
    if (value < 60) {
      parts.unshift(0);
    } else {
      value = (value - parts[0]) / _60;
      parts.unshift(value % _60);
      if (value >= 60) {
        value = (value - parts[0]) / _60;
        parts.unshift(value);
      }
    }
    return sign + parts.map((n) => String(n).padStart(2, "0")).join(":").replace(/000000\d*$/, "");
  }
  var intTime = {
    identify: (value) => typeof value === "bigint" || Number.isInteger(value),
    default: true,
    tag: "tag:yaml.org,2002:int",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,
    resolve: (str, _onError, { intAsBigInt }) => parseSexagesimal(str, intAsBigInt),
    stringify: stringifySexagesimal
  };
  var floatTime = {
    identify: (value) => typeof value === "number",
    default: true,
    tag: "tag:yaml.org,2002:float",
    format: "TIME",
    test: /^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,
    resolve: (str) => parseSexagesimal(str, false),
    stringify: stringifySexagesimal
  };
  var timestamp = {
    identify: (value) => value instanceof Date,
    default: true,
    tag: "tag:yaml.org,2002:timestamp",
    test: RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})" + "(?:" + "(?:t|T|[ \\t]+)" + "([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)" + "(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?" + ")?$"),
    resolve(str) {
      const match = str.match(timestamp.test);
      if (!match)
        throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");
      const [, year, month, day, hour, minute, second] = match.map(Number);
      const millisec = match[7] ? Number((match[7] + "00").substr(1, 3)) : 0;
      let date = Date.UTC(year, month - 1, day, hour || 0, minute || 0, second || 0, millisec);
      const tz = match[8];
      if (tz && tz !== "Z") {
        let d = parseSexagesimal(tz, false);
        if (Math.abs(d) < 30)
          d *= 60;
        date -= 60000 * d;
      }
      return new Date(date);
    },
    stringify: ({ value }) => value?.toISOString().replace(/(T00:00:00)?\.000Z$/, "") ?? ""
  };
  exports.floatTime = floatTime;
  exports.intTime = intTime;
  exports.timestamp = timestamp;
});

// node_modules/yaml/dist/schema/yaml-1.1/schema.js
var require_schema3 = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var binary = require_binary();
  var bool = require_bool2();
  var float = require_float2();
  var int = require_int2();
  var merge = require_merge();
  var omap = require_omap();
  var pairs = require_pairs();
  var set = require_set();
  var timestamp = require_timestamp();
  var schema = [
    map.map,
    seq.seq,
    string.string,
    _null.nullTag,
    bool.trueTag,
    bool.falseTag,
    int.intBin,
    int.intOct,
    int.int,
    int.intHex,
    float.floatNaN,
    float.floatExp,
    float.float,
    binary.binary,
    merge.merge,
    omap.omap,
    pairs.pairs,
    set.set,
    timestamp.intTime,
    timestamp.floatTime,
    timestamp.timestamp
  ];
  exports.schema = schema;
});

// node_modules/yaml/dist/schema/tags.js
var require_tags = __commonJS((exports) => {
  var map = require_map();
  var _null = require_null();
  var seq = require_seq();
  var string = require_string();
  var bool = require_bool();
  var float = require_float();
  var int = require_int();
  var schema = require_schema();
  var schema$1 = require_schema2();
  var binary = require_binary();
  var merge = require_merge();
  var omap = require_omap();
  var pairs = require_pairs();
  var schema$2 = require_schema3();
  var set = require_set();
  var timestamp = require_timestamp();
  var schemas = new Map([
    ["core", schema.schema],
    ["failsafe", [map.map, seq.seq, string.string]],
    ["json", schema$1.schema],
    ["yaml11", schema$2.schema],
    ["yaml-1.1", schema$2.schema]
  ]);
  var tagsByName = {
    binary: binary.binary,
    bool: bool.boolTag,
    float: float.float,
    floatExp: float.floatExp,
    floatNaN: float.floatNaN,
    floatTime: timestamp.floatTime,
    int: int.int,
    intHex: int.intHex,
    intOct: int.intOct,
    intTime: timestamp.intTime,
    map: map.map,
    merge: merge.merge,
    null: _null.nullTag,
    omap: omap.omap,
    pairs: pairs.pairs,
    seq: seq.seq,
    set: set.set,
    timestamp: timestamp.timestamp
  };
  var coreKnownTags = {
    "tag:yaml.org,2002:binary": binary.binary,
    "tag:yaml.org,2002:merge": merge.merge,
    "tag:yaml.org,2002:omap": omap.omap,
    "tag:yaml.org,2002:pairs": pairs.pairs,
    "tag:yaml.org,2002:set": set.set,
    "tag:yaml.org,2002:timestamp": timestamp.timestamp
  };
  function getTags(customTags, schemaName, addMergeTag) {
    const schemaTags = schemas.get(schemaName);
    if (schemaTags && !customTags) {
      return addMergeTag && !schemaTags.includes(merge.merge) ? schemaTags.concat(merge.merge) : schemaTags.slice();
    }
    let tags = schemaTags;
    if (!tags) {
      if (Array.isArray(customTags))
        tags = [];
      else {
        const keys = Array.from(schemas.keys()).filter((key) => key !== "yaml11").map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown schema "${schemaName}"; use one of ${keys} or define customTags array`);
      }
    }
    if (Array.isArray(customTags)) {
      for (const tag of customTags)
        tags = tags.concat(tag);
    } else if (typeof customTags === "function") {
      tags = customTags(tags.slice());
    }
    if (addMergeTag)
      tags = tags.concat(merge.merge);
    return tags.reduce((tags2, tag) => {
      const tagObj = typeof tag === "string" ? tagsByName[tag] : tag;
      if (!tagObj) {
        const tagName = JSON.stringify(tag);
        const keys = Object.keys(tagsByName).map((key) => JSON.stringify(key)).join(", ");
        throw new Error(`Unknown custom tag ${tagName}; use one of ${keys}`);
      }
      if (!tags2.includes(tagObj))
        tags2.push(tagObj);
      return tags2;
    }, []);
  }
  exports.coreKnownTags = coreKnownTags;
  exports.getTags = getTags;
});

// node_modules/yaml/dist/schema/Schema.js
var require_Schema = __commonJS((exports) => {
  var identity = require_identity();
  var map = require_map();
  var seq = require_seq();
  var string = require_string();
  var tags = require_tags();
  var sortMapEntriesByKey = (a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0;

  class Schema {
    constructor({ compat, customTags, merge, resolveKnownTags, schema, sortMapEntries, toStringDefaults }) {
      this.compat = Array.isArray(compat) ? tags.getTags(compat, "compat") : compat ? tags.getTags(null, compat) : null;
      this.name = typeof schema === "string" && schema || "core";
      this.knownTags = resolveKnownTags ? tags.coreKnownTags : {};
      this.tags = tags.getTags(customTags, this.name, merge);
      this.toStringOptions = toStringDefaults ?? null;
      Object.defineProperty(this, identity.MAP, { value: map.map });
      Object.defineProperty(this, identity.SCALAR, { value: string.string });
      Object.defineProperty(this, identity.SEQ, { value: seq.seq });
      this.sortMapEntries = typeof sortMapEntries === "function" ? sortMapEntries : sortMapEntries === true ? sortMapEntriesByKey : null;
    }
    clone() {
      const copy = Object.create(Schema.prototype, Object.getOwnPropertyDescriptors(this));
      copy.tags = this.tags.slice();
      return copy;
    }
  }
  exports.Schema = Schema;
});

// node_modules/yaml/dist/stringify/stringifyDocument.js
var require_stringifyDocument = __commonJS((exports) => {
  var identity = require_identity();
  var stringify = require_stringify();
  var stringifyComment = require_stringifyComment();
  function stringifyDocument(doc, options) {
    const lines = [];
    let hasDirectives = options.directives === true;
    if (options.directives !== false && doc.directives) {
      const dir = doc.directives.toString(doc);
      if (dir) {
        lines.push(dir);
        hasDirectives = true;
      } else if (doc.directives.docStart)
        hasDirectives = true;
    }
    if (hasDirectives)
      lines.push("---");
    const ctx = stringify.createStringifyContext(doc, options);
    const { commentString } = ctx.options;
    if (doc.commentBefore) {
      if (lines.length !== 1)
        lines.unshift("");
      const cs = commentString(doc.commentBefore);
      lines.unshift(stringifyComment.indentComment(cs, ""));
    }
    let chompKeep = false;
    let contentComment = null;
    if (doc.contents) {
      if (identity.isNode(doc.contents)) {
        if (doc.contents.spaceBefore && hasDirectives)
          lines.push("");
        if (doc.contents.commentBefore) {
          const cs = commentString(doc.contents.commentBefore);
          lines.push(stringifyComment.indentComment(cs, ""));
        }
        ctx.forceBlockIndent = !!doc.comment;
        contentComment = doc.contents.comment;
      }
      const onChompKeep = contentComment ? undefined : () => chompKeep = true;
      let body = stringify.stringify(doc.contents, ctx, () => contentComment = null, onChompKeep);
      if (contentComment)
        body += stringifyComment.lineComment(body, "", commentString(contentComment));
      if ((body[0] === "|" || body[0] === ">") && lines[lines.length - 1] === "---") {
        lines[lines.length - 1] = `--- ${body}`;
      } else
        lines.push(body);
    } else {
      lines.push(stringify.stringify(doc.contents, ctx));
    }
    if (doc.directives?.docEnd) {
      if (doc.comment) {
        const cs = commentString(doc.comment);
        if (cs.includes(`
`)) {
          lines.push("...");
          lines.push(stringifyComment.indentComment(cs, ""));
        } else {
          lines.push(`... ${cs}`);
        }
      } else {
        lines.push("...");
      }
    } else {
      let dc = doc.comment;
      if (dc && chompKeep)
        dc = dc.replace(/^\n+/, "");
      if (dc) {
        if ((!chompKeep || contentComment) && lines[lines.length - 1] !== "")
          lines.push("");
        lines.push(stringifyComment.indentComment(commentString(dc), ""));
      }
    }
    return lines.join(`
`) + `
`;
  }
  exports.stringifyDocument = stringifyDocument;
});

// node_modules/yaml/dist/doc/Document.js
var require_Document = __commonJS((exports) => {
  var Alias = require_Alias();
  var Collection = require_Collection();
  var identity = require_identity();
  var Pair = require_Pair();
  var toJS = require_toJS();
  var Schema = require_Schema();
  var stringifyDocument = require_stringifyDocument();
  var anchors = require_anchors();
  var applyReviver = require_applyReviver();
  var createNode = require_createNode();
  var directives = require_directives();

  class Document {
    constructor(value, replacer, options) {
      this.commentBefore = null;
      this.comment = null;
      this.errors = [];
      this.warnings = [];
      Object.defineProperty(this, identity.NODE_TYPE, { value: identity.DOC });
      let _replacer = null;
      if (typeof replacer === "function" || Array.isArray(replacer)) {
        _replacer = replacer;
      } else if (options === undefined && replacer) {
        options = replacer;
        replacer = undefined;
      }
      const opt = Object.assign({
        intAsBigInt: false,
        keepSourceTokens: false,
        logLevel: "warn",
        prettyErrors: true,
        strict: true,
        stringKeys: false,
        uniqueKeys: true,
        version: "1.2"
      }, options);
      this.options = opt;
      let { version } = opt;
      if (options?._directives) {
        this.directives = options._directives.atDocument();
        if (this.directives.yaml.explicit)
          version = this.directives.yaml.version;
      } else
        this.directives = new directives.Directives({ version });
      this.setSchema(version, options);
      this.contents = value === undefined ? null : this.createNode(value, _replacer, options);
    }
    clone() {
      const copy = Object.create(Document.prototype, {
        [identity.NODE_TYPE]: { value: identity.DOC }
      });
      copy.commentBefore = this.commentBefore;
      copy.comment = this.comment;
      copy.errors = this.errors.slice();
      copy.warnings = this.warnings.slice();
      copy.options = Object.assign({}, this.options);
      if (this.directives)
        copy.directives = this.directives.clone();
      copy.schema = this.schema.clone();
      copy.contents = identity.isNode(this.contents) ? this.contents.clone(copy.schema) : this.contents;
      if (this.range)
        copy.range = this.range.slice();
      return copy;
    }
    add(value) {
      if (assertCollection(this.contents))
        this.contents.add(value);
    }
    addIn(path2, value) {
      if (assertCollection(this.contents))
        this.contents.addIn(path2, value);
    }
    createAlias(node, name) {
      if (!node.anchor) {
        const prev = anchors.anchorNames(this);
        node.anchor = !name || prev.has(name) ? anchors.findNewAnchor(name || "a", prev) : name;
      }
      return new Alias.Alias(node.anchor);
    }
    createNode(value, replacer, options) {
      let _replacer = undefined;
      if (typeof replacer === "function") {
        value = replacer.call({ "": value }, "", value);
        _replacer = replacer;
      } else if (Array.isArray(replacer)) {
        const keyToStr = (v) => typeof v === "number" || v instanceof String || v instanceof Number;
        const asStr = replacer.filter(keyToStr).map(String);
        if (asStr.length > 0)
          replacer = replacer.concat(asStr);
        _replacer = replacer;
      } else if (options === undefined && replacer) {
        options = replacer;
        replacer = undefined;
      }
      const { aliasDuplicateObjects, anchorPrefix, flow, keepUndefined, onTagObj, tag } = options ?? {};
      const { onAnchor, setAnchors, sourceObjects } = anchors.createNodeAnchors(this, anchorPrefix || "a");
      const ctx = {
        aliasDuplicateObjects: aliasDuplicateObjects ?? true,
        keepUndefined: keepUndefined ?? false,
        onAnchor,
        onTagObj,
        replacer: _replacer,
        schema: this.schema,
        sourceObjects
      };
      const node = createNode.createNode(value, tag, ctx);
      if (flow && identity.isCollection(node))
        node.flow = true;
      setAnchors();
      return node;
    }
    createPair(key, value, options = {}) {
      const k = this.createNode(key, null, options);
      const v = this.createNode(value, null, options);
      return new Pair.Pair(k, v);
    }
    delete(key) {
      return assertCollection(this.contents) ? this.contents.delete(key) : false;
    }
    deleteIn(path2) {
      if (Collection.isEmptyPath(path2)) {
        if (this.contents == null)
          return false;
        this.contents = null;
        return true;
      }
      return assertCollection(this.contents) ? this.contents.deleteIn(path2) : false;
    }
    get(key, keepScalar) {
      return identity.isCollection(this.contents) ? this.contents.get(key, keepScalar) : undefined;
    }
    getIn(path2, keepScalar) {
      if (Collection.isEmptyPath(path2))
        return !keepScalar && identity.isScalar(this.contents) ? this.contents.value : this.contents;
      return identity.isCollection(this.contents) ? this.contents.getIn(path2, keepScalar) : undefined;
    }
    has(key) {
      return identity.isCollection(this.contents) ? this.contents.has(key) : false;
    }
    hasIn(path2) {
      if (Collection.isEmptyPath(path2))
        return this.contents !== undefined;
      return identity.isCollection(this.contents) ? this.contents.hasIn(path2) : false;
    }
    set(key, value) {
      if (this.contents == null) {
        this.contents = Collection.collectionFromPath(this.schema, [key], value);
      } else if (assertCollection(this.contents)) {
        this.contents.set(key, value);
      }
    }
    setIn(path2, value) {
      if (Collection.isEmptyPath(path2)) {
        this.contents = value;
      } else if (this.contents == null) {
        this.contents = Collection.collectionFromPath(this.schema, Array.from(path2), value);
      } else if (assertCollection(this.contents)) {
        this.contents.setIn(path2, value);
      }
    }
    setSchema(version, options = {}) {
      if (typeof version === "number")
        version = String(version);
      let opt;
      switch (version) {
        case "1.1":
          if (this.directives)
            this.directives.yaml.version = "1.1";
          else
            this.directives = new directives.Directives({ version: "1.1" });
          opt = { resolveKnownTags: false, schema: "yaml-1.1" };
          break;
        case "1.2":
        case "next":
          if (this.directives)
            this.directives.yaml.version = version;
          else
            this.directives = new directives.Directives({ version });
          opt = { resolveKnownTags: true, schema: "core" };
          break;
        case null:
          if (this.directives)
            delete this.directives;
          opt = null;
          break;
        default: {
          const sv = JSON.stringify(version);
          throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${sv}`);
        }
      }
      if (options.schema instanceof Object)
        this.schema = options.schema;
      else if (opt)
        this.schema = new Schema.Schema(Object.assign(opt, options));
      else
        throw new Error(`With a null YAML version, the { schema: Schema } option is required`);
    }
    toJS({ json, jsonArg, mapAsMap, maxAliasCount, onAnchor, reviver } = {}) {
      const ctx = {
        anchors: new Map,
        doc: this,
        keep: !json,
        mapAsMap: mapAsMap === true,
        mapKeyWarned: false,
        maxAliasCount: typeof maxAliasCount === "number" ? maxAliasCount : 100
      };
      const res = toJS.toJS(this.contents, jsonArg ?? "", ctx);
      if (typeof onAnchor === "function")
        for (const { count, res: res2 } of ctx.anchors.values())
          onAnchor(res2, count);
      return typeof reviver === "function" ? applyReviver.applyReviver(reviver, { "": res }, "", res) : res;
    }
    toJSON(jsonArg, onAnchor) {
      return this.toJS({ json: true, jsonArg, mapAsMap: false, onAnchor });
    }
    toString(options = {}) {
      if (this.errors.length > 0)
        throw new Error("Document with errors cannot be stringified");
      if ("indent" in options && (!Number.isInteger(options.indent) || Number(options.indent) <= 0)) {
        const s = JSON.stringify(options.indent);
        throw new Error(`"indent" option must be a positive integer, not ${s}`);
      }
      return stringifyDocument.stringifyDocument(this, options);
    }
  }
  function assertCollection(contents) {
    if (identity.isCollection(contents))
      return true;
    throw new Error("Expected a YAML collection as document contents");
  }
  exports.Document = Document;
});

// node_modules/yaml/dist/errors.js
var require_errors = __commonJS((exports) => {
  class YAMLError extends Error {
    constructor(name, pos, code, message) {
      super();
      this.name = name;
      this.code = code;
      this.message = message;
      this.pos = pos;
    }
  }

  class YAMLParseError extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLParseError", pos, code, message);
    }
  }

  class YAMLWarning extends YAMLError {
    constructor(pos, code, message) {
      super("YAMLWarning", pos, code, message);
    }
  }
  var prettifyError = (src, lc) => (error) => {
    if (error.pos[0] === -1)
      return;
    error.linePos = error.pos.map((pos) => lc.linePos(pos));
    const { line, col } = error.linePos[0];
    error.message += ` at line ${line}, column ${col}`;
    let ci = col - 1;
    let lineStr = src.substring(lc.lineStarts[line - 1], lc.lineStarts[line]).replace(/[\n\r]+$/, "");
    if (ci >= 60 && lineStr.length > 80) {
      const trimStart = Math.min(ci - 39, lineStr.length - 79);
      lineStr = "…" + lineStr.substring(trimStart);
      ci -= trimStart - 1;
    }
    if (lineStr.length > 80)
      lineStr = lineStr.substring(0, 79) + "…";
    if (line > 1 && /^ *$/.test(lineStr.substring(0, ci))) {
      let prev = src.substring(lc.lineStarts[line - 2], lc.lineStarts[line - 1]);
      if (prev.length > 80)
        prev = prev.substring(0, 79) + `…
`;
      lineStr = prev + lineStr;
    }
    if (/[^ ]/.test(lineStr)) {
      let count = 1;
      const end = error.linePos[1];
      if (end?.line === line && end.col > col) {
        count = Math.max(1, Math.min(end.col - col, 80 - ci));
      }
      const pointer = " ".repeat(ci) + "^".repeat(count);
      error.message += `:

${lineStr}
${pointer}
`;
    }
  };
  exports.YAMLError = YAMLError;
  exports.YAMLParseError = YAMLParseError;
  exports.YAMLWarning = YAMLWarning;
  exports.prettifyError = prettifyError;
});

// node_modules/yaml/dist/compose/resolve-props.js
var require_resolve_props = __commonJS((exports) => {
  function resolveProps(tokens, { flow, indicator, next, offset, onError, parentIndent, startOnNewline }) {
    let spaceBefore = false;
    let atNewline = startOnNewline;
    let hasSpace = startOnNewline;
    let comment = "";
    let commentSep = "";
    let hasNewline = false;
    let reqSpace = false;
    let tab = null;
    let anchor = null;
    let tag = null;
    let newlineAfterProp = null;
    let comma = null;
    let found = null;
    let start = null;
    for (const token of tokens) {
      if (reqSpace) {
        if (token.type !== "space" && token.type !== "newline" && token.type !== "comma")
          onError(token.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
        reqSpace = false;
      }
      if (tab) {
        if (atNewline && token.type !== "comment" && token.type !== "newline") {
          onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
        }
        tab = null;
      }
      switch (token.type) {
        case "space":
          if (!flow && (indicator !== "doc-start" || next?.type !== "flow-collection") && token.source.includes("\t")) {
            tab = token;
          }
          hasSpace = true;
          break;
        case "comment": {
          if (!hasSpace)
            onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
          const cb = token.source.substring(1) || " ";
          if (!comment)
            comment = cb;
          else
            comment += commentSep + cb;
          commentSep = "";
          atNewline = false;
          break;
        }
        case "newline":
          if (atNewline) {
            if (comment)
              comment += token.source;
            else if (!found || indicator !== "seq-item-ind")
              spaceBefore = true;
          } else
            commentSep += token.source;
          atNewline = true;
          hasNewline = true;
          if (anchor || tag)
            newlineAfterProp = token;
          hasSpace = true;
          break;
        case "anchor":
          if (anchor)
            onError(token, "MULTIPLE_ANCHORS", "A node can have at most one anchor");
          if (token.source.endsWith(":"))
            onError(token.offset + token.source.length - 1, "BAD_ALIAS", "Anchor ending in : is ambiguous", true);
          anchor = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        case "tag": {
          if (tag)
            onError(token, "MULTIPLE_TAGS", "A node can have at most one tag");
          tag = token;
          start ?? (start = token.offset);
          atNewline = false;
          hasSpace = false;
          reqSpace = true;
          break;
        }
        case indicator:
          if (anchor || tag)
            onError(token, "BAD_PROP_ORDER", `Anchors and tags must be after the ${token.source} indicator`);
          if (found)
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.source} in ${flow ?? "collection"}`);
          found = token;
          atNewline = indicator === "seq-item-ind" || indicator === "explicit-key-ind";
          hasSpace = false;
          break;
        case "comma":
          if (flow) {
            if (comma)
              onError(token, "UNEXPECTED_TOKEN", `Unexpected , in ${flow}`);
            comma = token;
            atNewline = false;
            hasSpace = false;
            break;
          }
        default:
          onError(token, "UNEXPECTED_TOKEN", `Unexpected ${token.type} token`);
          atNewline = false;
          hasSpace = false;
      }
    }
    const last = tokens[tokens.length - 1];
    const end = last ? last.offset + last.source.length : offset;
    if (reqSpace && next && next.type !== "space" && next.type !== "newline" && next.type !== "comma" && (next.type !== "scalar" || next.source !== "")) {
      onError(next.offset, "MISSING_CHAR", "Tags and anchors must be separated from the next token by white space");
    }
    if (tab && (atNewline && tab.indent <= parentIndent || next?.type === "block-map" || next?.type === "block-seq"))
      onError(tab, "TAB_AS_INDENT", "Tabs are not allowed as indentation");
    return {
      comma,
      found,
      spaceBefore,
      comment,
      hasNewline,
      anchor,
      tag,
      newlineAfterProp,
      end,
      start: start ?? end
    };
  }
  exports.resolveProps = resolveProps;
});

// node_modules/yaml/dist/compose/util-contains-newline.js
var require_util_contains_newline = __commonJS((exports) => {
  function containsNewline(key) {
    if (!key)
      return null;
    switch (key.type) {
      case "alias":
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        if (key.source.includes(`
`))
          return true;
        if (key.end) {
          for (const st of key.end)
            if (st.type === "newline")
              return true;
        }
        return false;
      case "flow-collection":
        for (const it of key.items) {
          for (const st of it.start)
            if (st.type === "newline")
              return true;
          if (it.sep) {
            for (const st of it.sep)
              if (st.type === "newline")
                return true;
          }
          if (containsNewline(it.key) || containsNewline(it.value))
            return true;
        }
        return false;
      default:
        return true;
    }
  }
  exports.containsNewline = containsNewline;
});

// node_modules/yaml/dist/compose/util-flow-indent-check.js
var require_util_flow_indent_check = __commonJS((exports) => {
  var utilContainsNewline = require_util_contains_newline();
  function flowIndentCheck(indent, fc, onError) {
    if (fc?.type === "flow-collection") {
      const end = fc.end[0];
      if (end.indent === indent && (end.source === "]" || end.source === "}") && utilContainsNewline.containsNewline(fc)) {
        const msg = "Flow end indicator should be more indented than parent";
        onError(end, "BAD_INDENT", msg, true);
      }
    }
  }
  exports.flowIndentCheck = flowIndentCheck;
});

// node_modules/yaml/dist/compose/util-map-includes.js
var require_util_map_includes = __commonJS((exports) => {
  var identity = require_identity();
  function mapIncludes(ctx, items, search) {
    const { uniqueKeys } = ctx.options;
    if (uniqueKeys === false)
      return false;
    const isEqual = typeof uniqueKeys === "function" ? uniqueKeys : (a, b) => a === b || identity.isScalar(a) && identity.isScalar(b) && a.value === b.value;
    return items.some((pair) => isEqual(pair.key, search));
  }
  exports.mapIncludes = mapIncludes;
});

// node_modules/yaml/dist/compose/resolve-block-map.js
var require_resolve_block_map = __commonJS((exports) => {
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();
  var resolveProps = require_resolve_props();
  var utilContainsNewline = require_util_contains_newline();
  var utilFlowIndentCheck = require_util_flow_indent_check();
  var utilMapIncludes = require_util_map_includes();
  var startColMsg = "All mapping items must start at the same column";
  function resolveBlockMap({ composeNode, composeEmptyNode }, ctx, bm, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLMap.YAMLMap;
    const map = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    let offset = bm.offset;
    let commentEnd = null;
    for (const collItem of bm.items) {
      const { start, key, sep, value } = collItem;
      const keyProps = resolveProps.resolveProps(start, {
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: bm.indent,
        startOnNewline: true
      });
      const implicitKey = !keyProps.found;
      if (implicitKey) {
        if (key) {
          if (key.type === "block-seq")
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "A block sequence may not be used as an implicit map key");
          else if ("indent" in key && key.indent !== bm.indent)
            onError(offset, "BAD_INDENT", startColMsg);
        }
        if (!keyProps.anchor && !keyProps.tag && !sep) {
          commentEnd = keyProps.end;
          if (keyProps.comment) {
            if (map.comment)
              map.comment += `
` + keyProps.comment;
            else
              map.comment = keyProps.comment;
          }
          continue;
        }
        if (keyProps.newlineAfterProp || utilContainsNewline.containsNewline(key)) {
          onError(key ?? start[start.length - 1], "MULTILINE_IMPLICIT_KEY", "Implicit keys need to be on a single line");
        }
      } else if (keyProps.found?.indent !== bm.indent) {
        onError(offset, "BAD_INDENT", startColMsg);
      }
      ctx.atKey = true;
      const keyStart = keyProps.end;
      const keyNode = key ? composeNode(ctx, key, keyProps, onError) : composeEmptyNode(ctx, keyStart, start, null, keyProps, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck.flowIndentCheck(bm.indent, key, onError);
      ctx.atKey = false;
      if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
        onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
      const valueProps = resolveProps.resolveProps(sep ?? [], {
        indicator: "map-value-ind",
        next: value,
        offset: keyNode.range[2],
        onError,
        parentIndent: bm.indent,
        startOnNewline: !key || key.type === "block-scalar"
      });
      offset = valueProps.end;
      if (valueProps.found) {
        if (implicitKey) {
          if (value?.type === "block-map" && !valueProps.hasNewline)
            onError(offset, "BLOCK_AS_IMPLICIT_KEY", "Nested mappings are not allowed in compact mappings");
          if (ctx.options.strict && keyProps.start < valueProps.found.offset - 1024)
            onError(keyNode.range, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit block mapping key");
        }
        const valueNode = value ? composeNode(ctx, value, valueProps, onError) : composeEmptyNode(ctx, offset, sep, null, valueProps, onError);
        if (ctx.schema.compat)
          utilFlowIndentCheck.flowIndentCheck(bm.indent, value, onError);
        offset = valueNode.range[2];
        const pair = new Pair.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map.items.push(pair);
      } else {
        if (implicitKey)
          onError(keyNode.range, "MISSING_CHAR", "Implicit map keys need to be followed by map values");
        if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += `
` + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair.Pair(keyNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        map.items.push(pair);
      }
    }
    if (commentEnd && commentEnd < offset)
      onError(commentEnd, "IMPOSSIBLE", "Map comment with trailing content");
    map.range = [bm.offset, offset, commentEnd ?? offset];
    return map;
  }
  exports.resolveBlockMap = resolveBlockMap;
});

// node_modules/yaml/dist/compose/resolve-block-seq.js
var require_resolve_block_seq = __commonJS((exports) => {
  var YAMLSeq = require_YAMLSeq();
  var resolveProps = require_resolve_props();
  var utilFlowIndentCheck = require_util_flow_indent_check();
  function resolveBlockSeq({ composeNode, composeEmptyNode }, ctx, bs, onError, tag) {
    const NodeClass = tag?.nodeClass ?? YAMLSeq.YAMLSeq;
    const seq = new NodeClass(ctx.schema);
    if (ctx.atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = bs.offset;
    let commentEnd = null;
    for (const { start, value } of bs.items) {
      const props = resolveProps.resolveProps(start, {
        indicator: "seq-item-ind",
        next: value,
        offset,
        onError,
        parentIndent: bs.indent,
        startOnNewline: true
      });
      if (!props.found) {
        if (props.anchor || props.tag || value) {
          if (value?.type === "block-seq")
            onError(props.end, "BAD_INDENT", "All sequence items must start at the same column");
          else
            onError(offset, "MISSING_CHAR", "Sequence item without - indicator");
        } else {
          commentEnd = props.end;
          if (props.comment)
            seq.comment = props.comment;
          continue;
        }
      }
      const node = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, start, null, props, onError);
      if (ctx.schema.compat)
        utilFlowIndentCheck.flowIndentCheck(bs.indent, value, onError);
      offset = node.range[2];
      seq.items.push(node);
    }
    seq.range = [bs.offset, offset, commentEnd ?? offset];
    return seq;
  }
  exports.resolveBlockSeq = resolveBlockSeq;
});

// node_modules/yaml/dist/compose/resolve-end.js
var require_resolve_end = __commonJS((exports) => {
  function resolveEnd(end, offset, reqSpace, onError) {
    let comment = "";
    if (end) {
      let hasSpace = false;
      let sep = "";
      for (const token of end) {
        const { source, type } = token;
        switch (type) {
          case "space":
            hasSpace = true;
            break;
          case "comment": {
            if (reqSpace && !hasSpace)
              onError(token, "MISSING_CHAR", "Comments must be separated from other tokens by white space characters");
            const cb = source.substring(1) || " ";
            if (!comment)
              comment = cb;
            else
              comment += sep + cb;
            sep = "";
            break;
          }
          case "newline":
            if (comment)
              sep += source;
            hasSpace = true;
            break;
          default:
            onError(token, "UNEXPECTED_TOKEN", `Unexpected ${type} at node end`);
        }
        offset += source.length;
      }
    }
    return { comment, offset };
  }
  exports.resolveEnd = resolveEnd;
});

// node_modules/yaml/dist/compose/resolve-flow-collection.js
var require_resolve_flow_collection = __commonJS((exports) => {
  var identity = require_identity();
  var Pair = require_Pair();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var resolveEnd = require_resolve_end();
  var resolveProps = require_resolve_props();
  var utilContainsNewline = require_util_contains_newline();
  var utilMapIncludes = require_util_map_includes();
  var blockMsg = "Block collections are not allowed within flow collections";
  var isBlock = (token) => token && (token.type === "block-map" || token.type === "block-seq");
  function resolveFlowCollection({ composeNode, composeEmptyNode }, ctx, fc, onError, tag) {
    const isMap = fc.start.source === "{";
    const fcName = isMap ? "flow map" : "flow sequence";
    const NodeClass = tag?.nodeClass ?? (isMap ? YAMLMap.YAMLMap : YAMLSeq.YAMLSeq);
    const coll = new NodeClass(ctx.schema);
    coll.flow = true;
    const atRoot = ctx.atRoot;
    if (atRoot)
      ctx.atRoot = false;
    if (ctx.atKey)
      ctx.atKey = false;
    let offset = fc.offset + fc.start.source.length;
    for (let i = 0;i < fc.items.length; ++i) {
      const collItem = fc.items[i];
      const { start, key, sep, value } = collItem;
      const props = resolveProps.resolveProps(start, {
        flow: fcName,
        indicator: "explicit-key-ind",
        next: key ?? sep?.[0],
        offset,
        onError,
        parentIndent: fc.indent,
        startOnNewline: false
      });
      if (!props.found) {
        if (!props.anchor && !props.tag && !sep && !value) {
          if (i === 0 && props.comma)
            onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
          else if (i < fc.items.length - 1)
            onError(props.start, "UNEXPECTED_TOKEN", `Unexpected empty item in ${fcName}`);
          if (props.comment) {
            if (coll.comment)
              coll.comment += `
` + props.comment;
            else
              coll.comment = props.comment;
          }
          offset = props.end;
          continue;
        }
        if (!isMap && ctx.options.strict && utilContainsNewline.containsNewline(key))
          onError(key, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
      }
      if (i === 0) {
        if (props.comma)
          onError(props.comma, "UNEXPECTED_TOKEN", `Unexpected , in ${fcName}`);
      } else {
        if (!props.comma)
          onError(props.start, "MISSING_CHAR", `Missing , between ${fcName} items`);
        if (props.comment) {
          let prevItemComment = "";
          loop:
            for (const st of start) {
              switch (st.type) {
                case "comma":
                case "space":
                  break;
                case "comment":
                  prevItemComment = st.source.substring(1);
                  break loop;
                default:
                  break loop;
              }
            }
          if (prevItemComment) {
            let prev = coll.items[coll.items.length - 1];
            if (identity.isPair(prev))
              prev = prev.value ?? prev.key;
            if (prev.comment)
              prev.comment += `
` + prevItemComment;
            else
              prev.comment = prevItemComment;
            props.comment = props.comment.substring(prevItemComment.length + 1);
          }
        }
      }
      if (!isMap && !sep && !props.found) {
        const valueNode = value ? composeNode(ctx, value, props, onError) : composeEmptyNode(ctx, props.end, sep, null, props, onError);
        coll.items.push(valueNode);
        offset = valueNode.range[2];
        if (isBlock(value))
          onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
      } else {
        ctx.atKey = true;
        const keyStart = props.end;
        const keyNode = key ? composeNode(ctx, key, props, onError) : composeEmptyNode(ctx, keyStart, start, null, props, onError);
        if (isBlock(key))
          onError(keyNode.range, "BLOCK_IN_FLOW", blockMsg);
        ctx.atKey = false;
        const valueProps = resolveProps.resolveProps(sep ?? [], {
          flow: fcName,
          indicator: "map-value-ind",
          next: value,
          offset: keyNode.range[2],
          onError,
          parentIndent: fc.indent,
          startOnNewline: false
        });
        if (valueProps.found) {
          if (!isMap && !props.found && ctx.options.strict) {
            if (sep)
              for (const st of sep) {
                if (st === valueProps.found)
                  break;
                if (st.type === "newline") {
                  onError(st, "MULTILINE_IMPLICIT_KEY", "Implicit keys of flow sequence pairs need to be on a single line");
                  break;
                }
              }
            if (props.start < valueProps.found.offset - 1024)
              onError(valueProps.found, "KEY_OVER_1024_CHARS", "The : indicator must be at most 1024 chars after the start of an implicit flow sequence key");
          }
        } else if (value) {
          if ("source" in value && value.source?.[0] === ":")
            onError(value, "MISSING_CHAR", `Missing space after : in ${fcName}`);
          else
            onError(valueProps.start, "MISSING_CHAR", `Missing , or : between ${fcName} items`);
        }
        const valueNode = value ? composeNode(ctx, value, valueProps, onError) : valueProps.found ? composeEmptyNode(ctx, valueProps.end, sep, null, valueProps, onError) : null;
        if (valueNode) {
          if (isBlock(value))
            onError(valueNode.range, "BLOCK_IN_FLOW", blockMsg);
        } else if (valueProps.comment) {
          if (keyNode.comment)
            keyNode.comment += `
` + valueProps.comment;
          else
            keyNode.comment = valueProps.comment;
        }
        const pair = new Pair.Pair(keyNode, valueNode);
        if (ctx.options.keepSourceTokens)
          pair.srcToken = collItem;
        if (isMap) {
          const map = coll;
          if (utilMapIncludes.mapIncludes(ctx, map.items, keyNode))
            onError(keyStart, "DUPLICATE_KEY", "Map keys must be unique");
          map.items.push(pair);
        } else {
          const map = new YAMLMap.YAMLMap(ctx.schema);
          map.flow = true;
          map.items.push(pair);
          const endRange = (valueNode ?? keyNode).range;
          map.range = [keyNode.range[0], endRange[1], endRange[2]];
          coll.items.push(map);
        }
        offset = valueNode ? valueNode.range[2] : valueProps.end;
      }
    }
    const expectedEnd = isMap ? "}" : "]";
    const [ce, ...ee] = fc.end;
    let cePos = offset;
    if (ce?.source === expectedEnd)
      cePos = ce.offset + ce.source.length;
    else {
      const name = fcName[0].toUpperCase() + fcName.substring(1);
      const msg = atRoot ? `${name} must end with a ${expectedEnd}` : `${name} in block collection must be sufficiently indented and end with a ${expectedEnd}`;
      onError(offset, atRoot ? "MISSING_CHAR" : "BAD_INDENT", msg);
      if (ce && ce.source.length !== 1)
        ee.unshift(ce);
    }
    if (ee.length > 0) {
      const end = resolveEnd.resolveEnd(ee, cePos, ctx.options.strict, onError);
      if (end.comment) {
        if (coll.comment)
          coll.comment += `
` + end.comment;
        else
          coll.comment = end.comment;
      }
      coll.range = [fc.offset, cePos, end.offset];
    } else {
      coll.range = [fc.offset, cePos, cePos];
    }
    return coll;
  }
  exports.resolveFlowCollection = resolveFlowCollection;
});

// node_modules/yaml/dist/compose/compose-collection.js
var require_compose_collection = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var resolveBlockMap = require_resolve_block_map();
  var resolveBlockSeq = require_resolve_block_seq();
  var resolveFlowCollection = require_resolve_flow_collection();
  function resolveCollection(CN, ctx, token, onError, tagName, tag) {
    const coll = token.type === "block-map" ? resolveBlockMap.resolveBlockMap(CN, ctx, token, onError, tag) : token.type === "block-seq" ? resolveBlockSeq.resolveBlockSeq(CN, ctx, token, onError, tag) : resolveFlowCollection.resolveFlowCollection(CN, ctx, token, onError, tag);
    const Coll = coll.constructor;
    if (tagName === "!" || tagName === Coll.tagName) {
      coll.tag = Coll.tagName;
      return coll;
    }
    if (tagName)
      coll.tag = tagName;
    return coll;
  }
  function composeCollection(CN, ctx, token, props, onError) {
    const tagToken = props.tag;
    const tagName = !tagToken ? null : ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg));
    if (token.type === "block-seq") {
      const { anchor, newlineAfterProp: nl } = props;
      const lastProp = anchor && tagToken ? anchor.offset > tagToken.offset ? anchor : tagToken : anchor ?? tagToken;
      if (lastProp && (!nl || nl.offset < lastProp.offset)) {
        const message = "Missing newline after block sequence props";
        onError(lastProp, "MISSING_CHAR", message);
      }
    }
    const expType = token.type === "block-map" ? "map" : token.type === "block-seq" ? "seq" : token.start.source === "{" ? "map" : "seq";
    if (!tagToken || !tagName || tagName === "!" || tagName === YAMLMap.YAMLMap.tagName && expType === "map" || tagName === YAMLSeq.YAMLSeq.tagName && expType === "seq") {
      return resolveCollection(CN, ctx, token, onError, tagName);
    }
    let tag = ctx.schema.tags.find((t) => t.tag === tagName && t.collection === expType);
    if (!tag) {
      const kt = ctx.schema.knownTags[tagName];
      if (kt?.collection === expType) {
        ctx.schema.tags.push(Object.assign({}, kt, { default: false }));
        tag = kt;
      } else {
        if (kt) {
          onError(tagToken, "BAD_COLLECTION_TYPE", `${kt.tag} used for ${expType} collection, but expects ${kt.collection ?? "scalar"}`, true);
        } else {
          onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, true);
        }
        return resolveCollection(CN, ctx, token, onError, tagName);
      }
    }
    const coll = resolveCollection(CN, ctx, token, onError, tagName, tag);
    const res = tag.resolve?.(coll, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg), ctx.options) ?? coll;
    const node = identity.isNode(res) ? res : new Scalar.Scalar(res);
    node.range = coll.range;
    node.tag = tagName;
    if (tag?.format)
      node.format = tag.format;
    return node;
  }
  exports.composeCollection = composeCollection;
});

// node_modules/yaml/dist/compose/resolve-block-scalar.js
var require_resolve_block_scalar = __commonJS((exports) => {
  var Scalar = require_Scalar();
  function resolveBlockScalar(ctx, scalar, onError) {
    const start = scalar.offset;
    const header = parseBlockScalarHeader(scalar, ctx.options.strict, onError);
    if (!header)
      return { value: "", type: null, comment: "", range: [start, start, start] };
    const type = header.mode === ">" ? Scalar.Scalar.BLOCK_FOLDED : Scalar.Scalar.BLOCK_LITERAL;
    const lines = scalar.source ? splitLines(scalar.source) : [];
    let chompStart = lines.length;
    for (let i = lines.length - 1;i >= 0; --i) {
      const content = lines[i][1];
      if (content === "" || content === "\r")
        chompStart = i;
      else
        break;
    }
    if (chompStart === 0) {
      const value2 = header.chomp === "+" && lines.length > 0 ? `
`.repeat(Math.max(1, lines.length - 1)) : "";
      let end2 = start + header.length;
      if (scalar.source)
        end2 += scalar.source.length;
      return { value: value2, type, comment: header.comment, range: [start, end2, end2] };
    }
    let trimIndent = scalar.indent + header.indent;
    let offset = scalar.offset + header.length;
    let contentStart = 0;
    for (let i = 0;i < chompStart; ++i) {
      const [indent, content] = lines[i];
      if (content === "" || content === "\r") {
        if (header.indent === 0 && indent.length > trimIndent)
          trimIndent = indent.length;
      } else {
        if (indent.length < trimIndent) {
          const message = "Block scalars with more-indented leading empty lines must use an explicit indentation indicator";
          onError(offset + indent.length, "MISSING_CHAR", message);
        }
        if (header.indent === 0)
          trimIndent = indent.length;
        contentStart = i;
        if (trimIndent === 0 && !ctx.atRoot) {
          const message = "Block scalar values in collections must be indented";
          onError(offset, "BAD_INDENT", message);
        }
        break;
      }
      offset += indent.length + content.length + 1;
    }
    for (let i = lines.length - 1;i >= chompStart; --i) {
      if (lines[i][0].length > trimIndent)
        chompStart = i + 1;
    }
    let value = "";
    let sep = "";
    let prevMoreIndented = false;
    for (let i = 0;i < contentStart; ++i)
      value += lines[i][0].slice(trimIndent) + `
`;
    for (let i = contentStart;i < chompStart; ++i) {
      let [indent, content] = lines[i];
      offset += indent.length + content.length + 1;
      const crlf = content[content.length - 1] === "\r";
      if (crlf)
        content = content.slice(0, -1);
      if (content && indent.length < trimIndent) {
        const src = header.indent ? "explicit indentation indicator" : "first line";
        const message = `Block scalar lines must not be less indented than their ${src}`;
        onError(offset - content.length - (crlf ? 2 : 1), "BAD_INDENT", message);
        indent = "";
      }
      if (type === Scalar.Scalar.BLOCK_LITERAL) {
        value += sep + indent.slice(trimIndent) + content;
        sep = `
`;
      } else if (indent.length > trimIndent || content[0] === "\t") {
        if (sep === " ")
          sep = `
`;
        else if (!prevMoreIndented && sep === `
`)
          sep = `

`;
        value += sep + indent.slice(trimIndent) + content;
        sep = `
`;
        prevMoreIndented = true;
      } else if (content === "") {
        if (sep === `
`)
          value += `
`;
        else
          sep = `
`;
      } else {
        value += sep + content;
        sep = " ";
        prevMoreIndented = false;
      }
    }
    switch (header.chomp) {
      case "-":
        break;
      case "+":
        for (let i = chompStart;i < lines.length; ++i)
          value += `
` + lines[i][0].slice(trimIndent);
        if (value[value.length - 1] !== `
`)
          value += `
`;
        break;
      default:
        value += `
`;
    }
    const end = start + header.length + scalar.source.length;
    return { value, type, comment: header.comment, range: [start, end, end] };
  }
  function parseBlockScalarHeader({ offset, props }, strict, onError) {
    if (props[0].type !== "block-scalar-header") {
      onError(props[0], "IMPOSSIBLE", "Block scalar header not found");
      return null;
    }
    const { source } = props[0];
    const mode = source[0];
    let indent = 0;
    let chomp = "";
    let error = -1;
    for (let i = 1;i < source.length; ++i) {
      const ch = source[i];
      if (!chomp && (ch === "-" || ch === "+"))
        chomp = ch;
      else {
        const n = Number(ch);
        if (!indent && n)
          indent = n;
        else if (error === -1)
          error = offset + i;
      }
    }
    if (error !== -1)
      onError(error, "UNEXPECTED_TOKEN", `Block scalar header includes extra characters: ${source}`);
    let hasSpace = false;
    let comment = "";
    let length = source.length;
    for (let i = 1;i < props.length; ++i) {
      const token = props[i];
      switch (token.type) {
        case "space":
          hasSpace = true;
        case "newline":
          length += token.source.length;
          break;
        case "comment":
          if (strict && !hasSpace) {
            const message = "Comments must be separated from other tokens by white space characters";
            onError(token, "MISSING_CHAR", message);
          }
          length += token.source.length;
          comment = token.source.substring(1);
          break;
        case "error":
          onError(token, "UNEXPECTED_TOKEN", token.message);
          length += token.source.length;
          break;
        default: {
          const message = `Unexpected token in block scalar header: ${token.type}`;
          onError(token, "UNEXPECTED_TOKEN", message);
          const ts = token.source;
          if (ts && typeof ts === "string")
            length += ts.length;
        }
      }
    }
    return { mode, indent, chomp, comment, length };
  }
  function splitLines(source) {
    const split = source.split(/\n( *)/);
    const first = split[0];
    const m = first.match(/^( *)/);
    const line0 = m?.[1] ? [m[1], first.slice(m[1].length)] : ["", first];
    const lines = [line0];
    for (let i = 1;i < split.length; i += 2)
      lines.push([split[i], split[i + 1]]);
    return lines;
  }
  exports.resolveBlockScalar = resolveBlockScalar;
});

// node_modules/yaml/dist/compose/resolve-flow-scalar.js
var require_resolve_flow_scalar = __commonJS((exports) => {
  var Scalar = require_Scalar();
  var resolveEnd = require_resolve_end();
  function resolveFlowScalar(scalar, strict, onError) {
    const { offset, type, source, end } = scalar;
    let _type;
    let value;
    const _onError = (rel, code, msg) => onError(offset + rel, code, msg);
    switch (type) {
      case "scalar":
        _type = Scalar.Scalar.PLAIN;
        value = plainValue(source, _onError);
        break;
      case "single-quoted-scalar":
        _type = Scalar.Scalar.QUOTE_SINGLE;
        value = singleQuotedValue(source, _onError);
        break;
      case "double-quoted-scalar":
        _type = Scalar.Scalar.QUOTE_DOUBLE;
        value = doubleQuotedValue(source, _onError);
        break;
      default:
        onError(scalar, "UNEXPECTED_TOKEN", `Expected a flow scalar value, but found: ${type}`);
        return {
          value: "",
          type: null,
          comment: "",
          range: [offset, offset + source.length, offset + source.length]
        };
    }
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, strict, onError);
    return {
      value,
      type: _type,
      comment: re.comment,
      range: [offset, valueEnd, re.offset]
    };
  }
  function plainValue(source, onError) {
    let badChar = "";
    switch (source[0]) {
      case "\t":
        badChar = "a tab character";
        break;
      case ",":
        badChar = "flow indicator character ,";
        break;
      case "%":
        badChar = "directive indicator character %";
        break;
      case "|":
      case ">": {
        badChar = `block scalar indicator ${source[0]}`;
        break;
      }
      case "@":
      case "`": {
        badChar = `reserved character ${source[0]}`;
        break;
      }
    }
    if (badChar)
      onError(0, "BAD_SCALAR_START", `Plain value cannot start with ${badChar}`);
    return foldLines(source);
  }
  function singleQuotedValue(source, onError) {
    if (source[source.length - 1] !== "'" || source.length === 1)
      onError(source.length, "MISSING_CHAR", "Missing closing 'quote");
    return foldLines(source.slice(1, -1)).replace(/''/g, "'");
  }
  function foldLines(source) {
    let first, line;
    try {
      first = new RegExp(`(.*?)(?<![ 	])[ 	]*\r?
`, "sy");
      line = new RegExp(`[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?
`, "sy");
    } catch {
      first = /(.*?)[ \t]*\r?\n/sy;
      line = /[ \t]*(.*?)[ \t]*\r?\n/sy;
    }
    let match = first.exec(source);
    if (!match)
      return source;
    let res = match[1];
    let sep = " ";
    let pos = first.lastIndex;
    line.lastIndex = pos;
    while (match = line.exec(source)) {
      if (match[1] === "") {
        if (sep === `
`)
          res += sep;
        else
          sep = `
`;
      } else {
        res += sep + match[1];
        sep = " ";
      }
      pos = line.lastIndex;
    }
    const last = /[ \t]*(.*)/sy;
    last.lastIndex = pos;
    match = last.exec(source);
    return res + sep + (match?.[1] ?? "");
  }
  function doubleQuotedValue(source, onError) {
    let res = "";
    for (let i = 1;i < source.length - 1; ++i) {
      const ch = source[i];
      if (ch === "\r" && source[i + 1] === `
`)
        continue;
      if (ch === `
`) {
        const { fold, offset } = foldNewline(source, i);
        res += fold;
        i = offset;
      } else if (ch === "\\") {
        let next = source[++i];
        const cc = escapeCodes[next];
        if (cc)
          res += cc;
        else if (next === `
`) {
          next = source[i + 1];
          while (next === " " || next === "\t")
            next = source[++i + 1];
        } else if (next === "\r" && source[i + 1] === `
`) {
          next = source[++i + 1];
          while (next === " " || next === "\t")
            next = source[++i + 1];
        } else if (next === "x" || next === "u" || next === "U") {
          const length = { x: 2, u: 4, U: 8 }[next];
          res += parseCharCode(source, i + 1, length, onError);
          i += length;
        } else {
          const raw = source.substr(i - 1, 2);
          onError(i - 1, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
          res += raw;
        }
      } else if (ch === " " || ch === "\t") {
        const wsStart = i;
        let next = source[i + 1];
        while (next === " " || next === "\t")
          next = source[++i + 1];
        if (next !== `
` && !(next === "\r" && source[i + 2] === `
`))
          res += i > wsStart ? source.slice(wsStart, i + 1) : ch;
      } else {
        res += ch;
      }
    }
    if (source[source.length - 1] !== '"' || source.length === 1)
      onError(source.length, "MISSING_CHAR", 'Missing closing "quote');
    return res;
  }
  function foldNewline(source, offset) {
    let fold = "";
    let ch = source[offset + 1];
    while (ch === " " || ch === "\t" || ch === `
` || ch === "\r") {
      if (ch === "\r" && source[offset + 2] !== `
`)
        break;
      if (ch === `
`)
        fold += `
`;
      offset += 1;
      ch = source[offset + 1];
    }
    if (!fold)
      fold = " ";
    return { fold, offset };
  }
  var escapeCodes = {
    "0": "\x00",
    a: "\x07",
    b: "\b",
    e: "\x1B",
    f: "\f",
    n: `
`,
    r: "\r",
    t: "\t",
    v: "\v",
    N: "",
    _: " ",
    L: "\u2028",
    P: "\u2029",
    " ": " ",
    '"': '"',
    "/": "/",
    "\\": "\\",
    "\t": "\t"
  };
  function parseCharCode(source, offset, length, onError) {
    const cc = source.substr(offset, length);
    const ok = cc.length === length && /^[0-9a-fA-F]+$/.test(cc);
    const code = ok ? parseInt(cc, 16) : NaN;
    if (isNaN(code)) {
      const raw = source.substr(offset - 2, length + 2);
      onError(offset - 2, "BAD_DQ_ESCAPE", `Invalid escape sequence ${raw}`);
      return raw;
    }
    return String.fromCodePoint(code);
  }
  exports.resolveFlowScalar = resolveFlowScalar;
});

// node_modules/yaml/dist/compose/compose-scalar.js
var require_compose_scalar = __commonJS((exports) => {
  var identity = require_identity();
  var Scalar = require_Scalar();
  var resolveBlockScalar = require_resolve_block_scalar();
  var resolveFlowScalar = require_resolve_flow_scalar();
  function composeScalar(ctx, token, tagToken, onError) {
    const { value, type, comment, range } = token.type === "block-scalar" ? resolveBlockScalar.resolveBlockScalar(ctx, token, onError) : resolveFlowScalar.resolveFlowScalar(token, ctx.options.strict, onError);
    const tagName = tagToken ? ctx.directives.tagName(tagToken.source, (msg) => onError(tagToken, "TAG_RESOLVE_FAILED", msg)) : null;
    let tag;
    if (ctx.options.stringKeys && ctx.atKey) {
      tag = ctx.schema[identity.SCALAR];
    } else if (tagName)
      tag = findScalarTagByName(ctx.schema, value, tagName, tagToken, onError);
    else if (token.type === "scalar")
      tag = findScalarTagByTest(ctx, value, token, onError);
    else
      tag = ctx.schema[identity.SCALAR];
    let scalar;
    try {
      const res = tag.resolve(value, (msg) => onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg), ctx.options);
      scalar = identity.isScalar(res) ? res : new Scalar.Scalar(res);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      onError(tagToken ?? token, "TAG_RESOLVE_FAILED", msg);
      scalar = new Scalar.Scalar(value);
    }
    scalar.range = range;
    scalar.source = value;
    if (type)
      scalar.type = type;
    if (tagName)
      scalar.tag = tagName;
    if (tag.format)
      scalar.format = tag.format;
    if (comment)
      scalar.comment = comment;
    return scalar;
  }
  function findScalarTagByName(schema, value, tagName, tagToken, onError) {
    if (tagName === "!")
      return schema[identity.SCALAR];
    const matchWithTest = [];
    for (const tag of schema.tags) {
      if (!tag.collection && tag.tag === tagName) {
        if (tag.default && tag.test)
          matchWithTest.push(tag);
        else
          return tag;
      }
    }
    for (const tag of matchWithTest)
      if (tag.test?.test(value))
        return tag;
    const kt = schema.knownTags[tagName];
    if (kt && !kt.collection) {
      schema.tags.push(Object.assign({}, kt, { default: false, test: undefined }));
      return kt;
    }
    onError(tagToken, "TAG_RESOLVE_FAILED", `Unresolved tag: ${tagName}`, tagName !== "tag:yaml.org,2002:str");
    return schema[identity.SCALAR];
  }
  function findScalarTagByTest({ atKey, directives, schema }, value, token, onError) {
    const tag = schema.tags.find((tag2) => (tag2.default === true || atKey && tag2.default === "key") && tag2.test?.test(value)) || schema[identity.SCALAR];
    if (schema.compat) {
      const compat = schema.compat.find((tag2) => tag2.default && tag2.test?.test(value)) ?? schema[identity.SCALAR];
      if (tag.tag !== compat.tag) {
        const ts = directives.tagString(tag.tag);
        const cs = directives.tagString(compat.tag);
        const msg = `Value may be parsed as either ${ts} or ${cs}`;
        onError(token, "TAG_RESOLVE_FAILED", msg, true);
      }
    }
    return tag;
  }
  exports.composeScalar = composeScalar;
});

// node_modules/yaml/dist/compose/util-empty-scalar-position.js
var require_util_empty_scalar_position = __commonJS((exports) => {
  function emptyScalarPosition(offset, before, pos) {
    if (before) {
      pos ?? (pos = before.length);
      for (let i = pos - 1;i >= 0; --i) {
        let st = before[i];
        switch (st.type) {
          case "space":
          case "comment":
          case "newline":
            offset -= st.source.length;
            continue;
        }
        st = before[++i];
        while (st?.type === "space") {
          offset += st.source.length;
          st = before[++i];
        }
        break;
      }
    }
    return offset;
  }
  exports.emptyScalarPosition = emptyScalarPosition;
});

// node_modules/yaml/dist/compose/compose-node.js
var require_compose_node = __commonJS((exports) => {
  var Alias = require_Alias();
  var identity = require_identity();
  var composeCollection = require_compose_collection();
  var composeScalar = require_compose_scalar();
  var resolveEnd = require_resolve_end();
  var utilEmptyScalarPosition = require_util_empty_scalar_position();
  var CN = { composeNode, composeEmptyNode };
  function composeNode(ctx, token, props, onError) {
    const atKey = ctx.atKey;
    const { spaceBefore, comment, anchor, tag } = props;
    let node;
    let isSrcToken = true;
    switch (token.type) {
      case "alias":
        node = composeAlias(ctx, token, onError);
        if (anchor || tag)
          onError(token, "ALIAS_PROPS", "An alias node must not specify any properties");
        break;
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "block-scalar":
        node = composeScalar.composeScalar(ctx, token, tag, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      case "block-map":
      case "block-seq":
      case "flow-collection":
        node = composeCollection.composeCollection(CN, ctx, token, props, onError);
        if (anchor)
          node.anchor = anchor.source.substring(1);
        break;
      default: {
        const message = token.type === "error" ? token.message : `Unsupported token (type: ${token.type})`;
        onError(token, "UNEXPECTED_TOKEN", message);
        node = composeEmptyNode(ctx, token.offset, undefined, null, props, onError);
        isSrcToken = false;
      }
    }
    if (anchor && node.anchor === "")
      onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    if (atKey && ctx.options.stringKeys && (!identity.isScalar(node) || typeof node.value !== "string" || node.tag && node.tag !== "tag:yaml.org,2002:str")) {
      const msg = "With stringKeys, all keys must be strings";
      onError(tag ?? token, "NON_STRING_KEY", msg);
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      if (token.type === "scalar" && token.source === "")
        node.comment = comment;
      else
        node.commentBefore = comment;
    }
    if (ctx.options.keepSourceTokens && isSrcToken)
      node.srcToken = token;
    return node;
  }
  function composeEmptyNode(ctx, offset, before, pos, { spaceBefore, comment, anchor, tag, end }, onError) {
    const token = {
      type: "scalar",
      offset: utilEmptyScalarPosition.emptyScalarPosition(offset, before, pos),
      indent: -1,
      source: ""
    };
    const node = composeScalar.composeScalar(ctx, token, tag, onError);
    if (anchor) {
      node.anchor = anchor.source.substring(1);
      if (node.anchor === "")
        onError(anchor, "BAD_ALIAS", "Anchor cannot be an empty string");
    }
    if (spaceBefore)
      node.spaceBefore = true;
    if (comment) {
      node.comment = comment;
      node.range[2] = end;
    }
    return node;
  }
  function composeAlias({ options }, { offset, source, end }, onError) {
    const alias = new Alias.Alias(source.substring(1));
    if (alias.source === "")
      onError(offset, "BAD_ALIAS", "Alias cannot be an empty string");
    if (alias.source.endsWith(":"))
      onError(offset + source.length - 1, "BAD_ALIAS", "Alias ending in : is ambiguous", true);
    const valueEnd = offset + source.length;
    const re = resolveEnd.resolveEnd(end, valueEnd, options.strict, onError);
    alias.range = [offset, valueEnd, re.offset];
    if (re.comment)
      alias.comment = re.comment;
    return alias;
  }
  exports.composeEmptyNode = composeEmptyNode;
  exports.composeNode = composeNode;
});

// node_modules/yaml/dist/compose/compose-doc.js
var require_compose_doc = __commonJS((exports) => {
  var Document = require_Document();
  var composeNode = require_compose_node();
  var resolveEnd = require_resolve_end();
  var resolveProps = require_resolve_props();
  function composeDoc(options, directives, { offset, start, value, end }, onError) {
    const opts = Object.assign({ _directives: directives }, options);
    const doc = new Document.Document(undefined, opts);
    const ctx = {
      atKey: false,
      atRoot: true,
      directives: doc.directives,
      options: doc.options,
      schema: doc.schema
    };
    const props = resolveProps.resolveProps(start, {
      indicator: "doc-start",
      next: value ?? end?.[0],
      offset,
      onError,
      parentIndent: 0,
      startOnNewline: true
    });
    if (props.found) {
      doc.directives.docStart = true;
      if (value && (value.type === "block-map" || value.type === "block-seq") && !props.hasNewline)
        onError(props.end, "MISSING_CHAR", "Block collection cannot start on same line with directives-end marker");
    }
    doc.contents = value ? composeNode.composeNode(ctx, value, props, onError) : composeNode.composeEmptyNode(ctx, props.end, start, null, props, onError);
    const contentEnd = doc.contents.range[2];
    const re = resolveEnd.resolveEnd(end, contentEnd, false, onError);
    if (re.comment)
      doc.comment = re.comment;
    doc.range = [offset, contentEnd, re.offset];
    return doc;
  }
  exports.composeDoc = composeDoc;
});

// node_modules/yaml/dist/compose/composer.js
var require_composer = __commonJS((exports) => {
  var node_process = __require("process");
  var directives = require_directives();
  var Document = require_Document();
  var errors = require_errors();
  var identity = require_identity();
  var composeDoc = require_compose_doc();
  var resolveEnd = require_resolve_end();
  function getErrorPos(src) {
    if (typeof src === "number")
      return [src, src + 1];
    if (Array.isArray(src))
      return src.length === 2 ? src : [src[0], src[1]];
    const { offset, source } = src;
    return [offset, offset + (typeof source === "string" ? source.length : 1)];
  }
  function parsePrelude(prelude) {
    let comment = "";
    let atComment = false;
    let afterEmptyLine = false;
    for (let i = 0;i < prelude.length; ++i) {
      const source = prelude[i];
      switch (source[0]) {
        case "#":
          comment += (comment === "" ? "" : afterEmptyLine ? `

` : `
`) + (source.substring(1) || " ");
          atComment = true;
          afterEmptyLine = false;
          break;
        case "%":
          if (prelude[i + 1]?.[0] !== "#")
            i += 1;
          atComment = false;
          break;
        default:
          if (!atComment)
            afterEmptyLine = true;
          atComment = false;
      }
    }
    return { comment, afterEmptyLine };
  }

  class Composer {
    constructor(options = {}) {
      this.doc = null;
      this.atDirectives = false;
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
      this.onError = (source, code, message, warning) => {
        const pos = getErrorPos(source);
        if (warning)
          this.warnings.push(new errors.YAMLWarning(pos, code, message));
        else
          this.errors.push(new errors.YAMLParseError(pos, code, message));
      };
      this.directives = new directives.Directives({ version: options.version || "1.2" });
      this.options = options;
    }
    decorate(doc, afterDoc) {
      const { comment, afterEmptyLine } = parsePrelude(this.prelude);
      if (comment) {
        const dc = doc.contents;
        if (afterDoc) {
          doc.comment = doc.comment ? `${doc.comment}
${comment}` : comment;
        } else if (afterEmptyLine || doc.directives.docStart || !dc) {
          doc.commentBefore = comment;
        } else if (identity.isCollection(dc) && !dc.flow && dc.items.length > 0) {
          let it = dc.items[0];
          if (identity.isPair(it))
            it = it.key;
          const cb = it.commentBefore;
          it.commentBefore = cb ? `${comment}
${cb}` : comment;
        } else {
          const cb = dc.commentBefore;
          dc.commentBefore = cb ? `${comment}
${cb}` : comment;
        }
      }
      if (afterDoc) {
        Array.prototype.push.apply(doc.errors, this.errors);
        Array.prototype.push.apply(doc.warnings, this.warnings);
      } else {
        doc.errors = this.errors;
        doc.warnings = this.warnings;
      }
      this.prelude = [];
      this.errors = [];
      this.warnings = [];
    }
    streamInfo() {
      return {
        comment: parsePrelude(this.prelude).comment,
        directives: this.directives,
        errors: this.errors,
        warnings: this.warnings
      };
    }
    *compose(tokens, forceDoc = false, endOffset = -1) {
      for (const token of tokens)
        yield* this.next(token);
      yield* this.end(forceDoc, endOffset);
    }
    *next(token) {
      if (node_process.env.LOG_STREAM)
        console.dir(token, { depth: null });
      switch (token.type) {
        case "directive":
          this.directives.add(token.source, (offset, message, warning) => {
            const pos = getErrorPos(token);
            pos[0] += offset;
            this.onError(pos, "BAD_DIRECTIVE", message, warning);
          });
          this.prelude.push(token.source);
          this.atDirectives = true;
          break;
        case "document": {
          const doc = composeDoc.composeDoc(this.options, this.directives, token, this.onError);
          if (this.atDirectives && !doc.directives.docStart)
            this.onError(token, "MISSING_CHAR", "Missing directives-end/doc-start indicator line");
          this.decorate(doc, false);
          if (this.doc)
            yield this.doc;
          this.doc = doc;
          this.atDirectives = false;
          break;
        }
        case "byte-order-mark":
        case "space":
          break;
        case "comment":
        case "newline":
          this.prelude.push(token.source);
          break;
        case "error": {
          const msg = token.source ? `${token.message}: ${JSON.stringify(token.source)}` : token.message;
          const error = new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg);
          if (this.atDirectives || !this.doc)
            this.errors.push(error);
          else
            this.doc.errors.push(error);
          break;
        }
        case "doc-end": {
          if (!this.doc) {
            const msg = "Unexpected doc-end without preceding document";
            this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", msg));
            break;
          }
          this.doc.directives.docEnd = true;
          const end = resolveEnd.resolveEnd(token.end, token.offset + token.source.length, this.doc.options.strict, this.onError);
          this.decorate(this.doc, true);
          if (end.comment) {
            const dc = this.doc.comment;
            this.doc.comment = dc ? `${dc}
${end.comment}` : end.comment;
          }
          this.doc.range[2] = end.offset;
          break;
        }
        default:
          this.errors.push(new errors.YAMLParseError(getErrorPos(token), "UNEXPECTED_TOKEN", `Unsupported token ${token.type}`));
      }
    }
    *end(forceDoc = false, endOffset = -1) {
      if (this.doc) {
        this.decorate(this.doc, true);
        yield this.doc;
        this.doc = null;
      } else if (forceDoc) {
        const opts = Object.assign({ _directives: this.directives }, this.options);
        const doc = new Document.Document(undefined, opts);
        if (this.atDirectives)
          this.onError(endOffset, "MISSING_CHAR", "Missing directives-end indicator line");
        doc.range = [0, endOffset, endOffset];
        this.decorate(doc, false);
        yield doc;
      }
    }
  }
  exports.Composer = Composer;
});

// node_modules/yaml/dist/parse/cst-scalar.js
var require_cst_scalar = __commonJS((exports) => {
  var resolveBlockScalar = require_resolve_block_scalar();
  var resolveFlowScalar = require_resolve_flow_scalar();
  var errors = require_errors();
  var stringifyString = require_stringifyString();
  function resolveAsScalar(token, strict = true, onError) {
    if (token) {
      const _onError = (pos, code, message) => {
        const offset = typeof pos === "number" ? pos : Array.isArray(pos) ? pos[0] : pos.offset;
        if (onError)
          onError(offset, code, message);
        else
          throw new errors.YAMLParseError([offset, offset + 1], code, message);
      };
      switch (token.type) {
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return resolveFlowScalar.resolveFlowScalar(token, strict, _onError);
        case "block-scalar":
          return resolveBlockScalar.resolveBlockScalar({ options: { strict } }, token, _onError);
      }
    }
    return null;
  }
  function createScalarToken(value, context) {
    const { implicitKey = false, indent, inFlow = false, offset = -1, type = "PLAIN" } = context;
    const source = stringifyString.stringifyString({ type, value }, {
      implicitKey,
      indent: indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    const end = context.end ?? [
      { type: "newline", offset: -1, indent, source: `
` }
    ];
    switch (source[0]) {
      case "|":
      case ">": {
        const he = source.indexOf(`
`);
        const head = source.substring(0, he);
        const body = source.substring(he + 1) + `
`;
        const props = [
          { type: "block-scalar-header", offset, indent, source: head }
        ];
        if (!addEndtoBlockProps(props, end))
          props.push({ type: "newline", offset: -1, indent, source: `
` });
        return { type: "block-scalar", offset, indent, props, source: body };
      }
      case '"':
        return { type: "double-quoted-scalar", offset, indent, source, end };
      case "'":
        return { type: "single-quoted-scalar", offset, indent, source, end };
      default:
        return { type: "scalar", offset, indent, source, end };
    }
  }
  function setScalarValue(token, value, context = {}) {
    let { afterKey = false, implicitKey = false, inFlow = false, type } = context;
    let indent = "indent" in token ? token.indent : null;
    if (afterKey && typeof indent === "number")
      indent += 2;
    if (!type)
      switch (token.type) {
        case "single-quoted-scalar":
          type = "QUOTE_SINGLE";
          break;
        case "double-quoted-scalar":
          type = "QUOTE_DOUBLE";
          break;
        case "block-scalar": {
          const header = token.props[0];
          if (header.type !== "block-scalar-header")
            throw new Error("Invalid block scalar header");
          type = header.source[0] === ">" ? "BLOCK_FOLDED" : "BLOCK_LITERAL";
          break;
        }
        default:
          type = "PLAIN";
      }
    const source = stringifyString.stringifyString({ type, value }, {
      implicitKey: implicitKey || indent === null,
      indent: indent !== null && indent > 0 ? " ".repeat(indent) : "",
      inFlow,
      options: { blockQuote: true, lineWidth: -1 }
    });
    switch (source[0]) {
      case "|":
      case ">":
        setBlockScalarValue(token, source);
        break;
      case '"':
        setFlowScalarValue(token, source, "double-quoted-scalar");
        break;
      case "'":
        setFlowScalarValue(token, source, "single-quoted-scalar");
        break;
      default:
        setFlowScalarValue(token, source, "scalar");
    }
  }
  function setBlockScalarValue(token, source) {
    const he = source.indexOf(`
`);
    const head = source.substring(0, he);
    const body = source.substring(he + 1) + `
`;
    if (token.type === "block-scalar") {
      const header = token.props[0];
      if (header.type !== "block-scalar-header")
        throw new Error("Invalid block scalar header");
      header.source = head;
      token.source = body;
    } else {
      const { offset } = token;
      const indent = "indent" in token ? token.indent : -1;
      const props = [
        { type: "block-scalar-header", offset, indent, source: head }
      ];
      if (!addEndtoBlockProps(props, "end" in token ? token.end : undefined))
        props.push({ type: "newline", offset: -1, indent, source: `
` });
      for (const key of Object.keys(token))
        if (key !== "type" && key !== "offset")
          delete token[key];
      Object.assign(token, { type: "block-scalar", indent, props, source: body });
    }
  }
  function addEndtoBlockProps(props, end) {
    if (end)
      for (const st of end)
        switch (st.type) {
          case "space":
          case "comment":
            props.push(st);
            break;
          case "newline":
            props.push(st);
            return true;
        }
    return false;
  }
  function setFlowScalarValue(token, source, type) {
    switch (token.type) {
      case "scalar":
      case "double-quoted-scalar":
      case "single-quoted-scalar":
        token.type = type;
        token.source = source;
        break;
      case "block-scalar": {
        const end = token.props.slice(1);
        let oa = source.length;
        if (token.props[0].type === "block-scalar-header")
          oa -= token.props[0].source.length;
        for (const tok of end)
          tok.offset += oa;
        delete token.props;
        Object.assign(token, { type, source, end });
        break;
      }
      case "block-map":
      case "block-seq": {
        const offset = token.offset + source.length;
        const nl = { type: "newline", offset, indent: token.indent, source: `
` };
        delete token.items;
        Object.assign(token, { type, source, end: [nl] });
        break;
      }
      default: {
        const indent = "indent" in token ? token.indent : -1;
        const end = "end" in token && Array.isArray(token.end) ? token.end.filter((st) => st.type === "space" || st.type === "comment" || st.type === "newline") : [];
        for (const key of Object.keys(token))
          if (key !== "type" && key !== "offset")
            delete token[key];
        Object.assign(token, { type, indent, source, end });
      }
    }
  }
  exports.createScalarToken = createScalarToken;
  exports.resolveAsScalar = resolveAsScalar;
  exports.setScalarValue = setScalarValue;
});

// node_modules/yaml/dist/parse/cst-stringify.js
var require_cst_stringify = __commonJS((exports) => {
  var stringify = (cst) => ("type" in cst) ? stringifyToken(cst) : stringifyItem(cst);
  function stringifyToken(token) {
    switch (token.type) {
      case "block-scalar": {
        let res = "";
        for (const tok of token.props)
          res += stringifyToken(tok);
        return res + token.source;
      }
      case "block-map":
      case "block-seq": {
        let res = "";
        for (const item of token.items)
          res += stringifyItem(item);
        return res;
      }
      case "flow-collection": {
        let res = token.start.source;
        for (const item of token.items)
          res += stringifyItem(item);
        for (const st of token.end)
          res += st.source;
        return res;
      }
      case "document": {
        let res = stringifyItem(token);
        if (token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
      default: {
        let res = token.source;
        if ("end" in token && token.end)
          for (const st of token.end)
            res += st.source;
        return res;
      }
    }
  }
  function stringifyItem({ start, key, sep, value }) {
    let res = "";
    for (const st of start)
      res += st.source;
    if (key)
      res += stringifyToken(key);
    if (sep)
      for (const st of sep)
        res += st.source;
    if (value)
      res += stringifyToken(value);
    return res;
  }
  exports.stringify = stringify;
});

// node_modules/yaml/dist/parse/cst-visit.js
var require_cst_visit = __commonJS((exports) => {
  var BREAK = Symbol("break visit");
  var SKIP = Symbol("skip children");
  var REMOVE = Symbol("remove item");
  function visit(cst, visitor) {
    if ("type" in cst && cst.type === "document")
      cst = { start: cst.start, value: cst.value };
    _visit(Object.freeze([]), cst, visitor);
  }
  visit.BREAK = BREAK;
  visit.SKIP = SKIP;
  visit.REMOVE = REMOVE;
  visit.itemAtPath = (cst, path2) => {
    let item = cst;
    for (const [field, index] of path2) {
      const tok = item?.[field];
      if (tok && "items" in tok) {
        item = tok.items[index];
      } else
        return;
    }
    return item;
  };
  visit.parentCollection = (cst, path2) => {
    const parent = visit.itemAtPath(cst, path2.slice(0, -1));
    const field = path2[path2.length - 1][0];
    const coll = parent?.[field];
    if (coll && "items" in coll)
      return coll;
    throw new Error("Parent collection not found");
  };
  function _visit(path2, item, visitor) {
    let ctrl = visitor(item, path2);
    if (typeof ctrl === "symbol")
      return ctrl;
    for (const field of ["key", "value"]) {
      const token = item[field];
      if (token && "items" in token) {
        for (let i = 0;i < token.items.length; ++i) {
          const ci = _visit(Object.freeze(path2.concat([[field, i]])), token.items[i], visitor);
          if (typeof ci === "number")
            i = ci - 1;
          else if (ci === BREAK)
            return BREAK;
          else if (ci === REMOVE) {
            token.items.splice(i, 1);
            i -= 1;
          }
        }
        if (typeof ctrl === "function" && field === "key")
          ctrl = ctrl(item, path2);
      }
    }
    return typeof ctrl === "function" ? ctrl(item, path2) : ctrl;
  }
  exports.visit = visit;
});

// node_modules/yaml/dist/parse/cst.js
var require_cst = __commonJS((exports) => {
  var cstScalar = require_cst_scalar();
  var cstStringify = require_cst_stringify();
  var cstVisit = require_cst_visit();
  var BOM = "\uFEFF";
  var DOCUMENT = "\x02";
  var FLOW_END = "\x18";
  var SCALAR = "\x1F";
  var isCollection = (token) => !!token && ("items" in token);
  var isScalar = (token) => !!token && (token.type === "scalar" || token.type === "single-quoted-scalar" || token.type === "double-quoted-scalar" || token.type === "block-scalar");
  function prettyToken(token) {
    switch (token) {
      case BOM:
        return "<BOM>";
      case DOCUMENT:
        return "<DOC>";
      case FLOW_END:
        return "<FLOW_END>";
      case SCALAR:
        return "<SCALAR>";
      default:
        return JSON.stringify(token);
    }
  }
  function tokenType(source) {
    switch (source) {
      case BOM:
        return "byte-order-mark";
      case DOCUMENT:
        return "doc-mode";
      case FLOW_END:
        return "flow-error-end";
      case SCALAR:
        return "scalar";
      case "---":
        return "doc-start";
      case "...":
        return "doc-end";
      case "":
      case `
`:
      case `\r
`:
        return "newline";
      case "-":
        return "seq-item-ind";
      case "?":
        return "explicit-key-ind";
      case ":":
        return "map-value-ind";
      case "{":
        return "flow-map-start";
      case "}":
        return "flow-map-end";
      case "[":
        return "flow-seq-start";
      case "]":
        return "flow-seq-end";
      case ",":
        return "comma";
    }
    switch (source[0]) {
      case " ":
      case "\t":
        return "space";
      case "#":
        return "comment";
      case "%":
        return "directive-line";
      case "*":
        return "alias";
      case "&":
        return "anchor";
      case "!":
        return "tag";
      case "'":
        return "single-quoted-scalar";
      case '"':
        return "double-quoted-scalar";
      case "|":
      case ">":
        return "block-scalar-header";
    }
    return null;
  }
  exports.createScalarToken = cstScalar.createScalarToken;
  exports.resolveAsScalar = cstScalar.resolveAsScalar;
  exports.setScalarValue = cstScalar.setScalarValue;
  exports.stringify = cstStringify.stringify;
  exports.visit = cstVisit.visit;
  exports.BOM = BOM;
  exports.DOCUMENT = DOCUMENT;
  exports.FLOW_END = FLOW_END;
  exports.SCALAR = SCALAR;
  exports.isCollection = isCollection;
  exports.isScalar = isScalar;
  exports.prettyToken = prettyToken;
  exports.tokenType = tokenType;
});

// node_modules/yaml/dist/parse/lexer.js
var require_lexer = __commonJS((exports) => {
  var cst = require_cst();
  function isEmpty(ch) {
    switch (ch) {
      case undefined:
      case " ":
      case `
`:
      case "\r":
      case "\t":
        return true;
      default:
        return false;
    }
  }
  var hexDigits = new Set("0123456789ABCDEFabcdef");
  var tagChars = new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()");
  var flowIndicatorChars = new Set(",[]{}");
  var invalidAnchorChars = new Set(` ,[]{}
\r	`);
  var isNotAnchorChar = (ch) => !ch || invalidAnchorChars.has(ch);

  class Lexer {
    constructor() {
      this.atEnd = false;
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      this.buffer = "";
      this.flowKey = false;
      this.flowLevel = 0;
      this.indentNext = 0;
      this.indentValue = 0;
      this.lineEndPos = null;
      this.next = null;
      this.pos = 0;
    }
    *lex(source, incomplete = false) {
      if (source) {
        if (typeof source !== "string")
          throw TypeError("source is not a string");
        this.buffer = this.buffer ? this.buffer + source : source;
        this.lineEndPos = null;
      }
      this.atEnd = !incomplete;
      let next = this.next ?? "stream";
      while (next && (incomplete || this.hasChars(1)))
        next = yield* this.parseNext(next);
    }
    atLineEnd() {
      let i = this.pos;
      let ch = this.buffer[i];
      while (ch === " " || ch === "\t")
        ch = this.buffer[++i];
      if (!ch || ch === "#" || ch === `
`)
        return true;
      if (ch === "\r")
        return this.buffer[i + 1] === `
`;
      return false;
    }
    charAt(n) {
      return this.buffer[this.pos + n];
    }
    continueScalar(offset) {
      let ch = this.buffer[offset];
      if (this.indentNext > 0) {
        let indent = 0;
        while (ch === " ")
          ch = this.buffer[++indent + offset];
        if (ch === "\r") {
          const next = this.buffer[indent + offset + 1];
          if (next === `
` || !next && !this.atEnd)
            return offset + indent + 1;
        }
        return ch === `
` || indent >= this.indentNext || !ch && !this.atEnd ? offset + indent : -1;
      }
      if (ch === "-" || ch === ".") {
        const dt = this.buffer.substr(offset, 3);
        if ((dt === "---" || dt === "...") && isEmpty(this.buffer[offset + 3]))
          return -1;
      }
      return offset;
    }
    getLine() {
      let end = this.lineEndPos;
      if (typeof end !== "number" || end !== -1 && end < this.pos) {
        end = this.buffer.indexOf(`
`, this.pos);
        this.lineEndPos = end;
      }
      if (end === -1)
        return this.atEnd ? this.buffer.substring(this.pos) : null;
      if (this.buffer[end - 1] === "\r")
        end -= 1;
      return this.buffer.substring(this.pos, end);
    }
    hasChars(n) {
      return this.pos + n <= this.buffer.length;
    }
    setNext(state) {
      this.buffer = this.buffer.substring(this.pos);
      this.pos = 0;
      this.lineEndPos = null;
      this.next = state;
      return null;
    }
    peek(n) {
      return this.buffer.substr(this.pos, n);
    }
    *parseNext(next) {
      switch (next) {
        case "stream":
          return yield* this.parseStream();
        case "line-start":
          return yield* this.parseLineStart();
        case "block-start":
          return yield* this.parseBlockStart();
        case "doc":
          return yield* this.parseDocument();
        case "flow":
          return yield* this.parseFlowCollection();
        case "quoted-scalar":
          return yield* this.parseQuotedScalar();
        case "block-scalar":
          return yield* this.parseBlockScalar();
        case "plain-scalar":
          return yield* this.parsePlainScalar();
      }
    }
    *parseStream() {
      let line = this.getLine();
      if (line === null)
        return this.setNext("stream");
      if (line[0] === cst.BOM) {
        yield* this.pushCount(1);
        line = line.substring(1);
      }
      if (line[0] === "%") {
        let dirEnd = line.length;
        let cs = line.indexOf("#");
        while (cs !== -1) {
          const ch = line[cs - 1];
          if (ch === " " || ch === "\t") {
            dirEnd = cs - 1;
            break;
          } else {
            cs = line.indexOf("#", cs + 1);
          }
        }
        while (true) {
          const ch = line[dirEnd - 1];
          if (ch === " " || ch === "\t")
            dirEnd -= 1;
          else
            break;
        }
        const n = (yield* this.pushCount(dirEnd)) + (yield* this.pushSpaces(true));
        yield* this.pushCount(line.length - n);
        this.pushNewline();
        return "stream";
      }
      if (this.atLineEnd()) {
        const sp = yield* this.pushSpaces(true);
        yield* this.pushCount(line.length - sp);
        yield* this.pushNewline();
        return "stream";
      }
      yield cst.DOCUMENT;
      return yield* this.parseLineStart();
    }
    *parseLineStart() {
      const ch = this.charAt(0);
      if (!ch && !this.atEnd)
        return this.setNext("line-start");
      if (ch === "-" || ch === ".") {
        if (!this.atEnd && !this.hasChars(4))
          return this.setNext("line-start");
        const s = this.peek(3);
        if ((s === "---" || s === "...") && isEmpty(this.charAt(3))) {
          yield* this.pushCount(3);
          this.indentValue = 0;
          this.indentNext = 0;
          return s === "---" ? "doc" : "stream";
        }
      }
      this.indentValue = yield* this.pushSpaces(false);
      if (this.indentNext > this.indentValue && !isEmpty(this.charAt(1)))
        this.indentNext = this.indentValue;
      return yield* this.parseBlockStart();
    }
    *parseBlockStart() {
      const [ch0, ch1] = this.peek(2);
      if (!ch1 && !this.atEnd)
        return this.setNext("block-start");
      if ((ch0 === "-" || ch0 === "?" || ch0 === ":") && isEmpty(ch1)) {
        const n = (yield* this.pushCount(1)) + (yield* this.pushSpaces(true));
        this.indentNext = this.indentValue + 1;
        this.indentValue += n;
        return yield* this.parseBlockStart();
      }
      return "doc";
    }
    *parseDocument() {
      yield* this.pushSpaces(true);
      const line = this.getLine();
      if (line === null)
        return this.setNext("doc");
      let n = yield* this.pushIndicators();
      switch (line[n]) {
        case "#":
          yield* this.pushCount(line.length - n);
        case undefined:
          yield* this.pushNewline();
          return yield* this.parseLineStart();
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel = 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          return "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "doc";
        case '"':
        case "'":
          return yield* this.parseQuotedScalar();
        case "|":
        case ">":
          n += yield* this.parseBlockScalarHeader();
          n += yield* this.pushSpaces(true);
          yield* this.pushCount(line.length - n);
          yield* this.pushNewline();
          return yield* this.parseBlockScalar();
        default:
          return yield* this.parsePlainScalar();
      }
    }
    *parseFlowCollection() {
      let nl, sp;
      let indent = -1;
      do {
        nl = yield* this.pushNewline();
        if (nl > 0) {
          sp = yield* this.pushSpaces(false);
          this.indentValue = indent = sp;
        } else {
          sp = 0;
        }
        sp += yield* this.pushSpaces(true);
      } while (nl + sp > 0);
      const line = this.getLine();
      if (line === null)
        return this.setNext("flow");
      if (indent !== -1 && indent < this.indentNext && line[0] !== "#" || indent === 0 && (line.startsWith("---") || line.startsWith("...")) && isEmpty(line[3])) {
        const atFlowEndMarker = indent === this.indentNext - 1 && this.flowLevel === 1 && (line[0] === "]" || line[0] === "}");
        if (!atFlowEndMarker) {
          this.flowLevel = 0;
          yield cst.FLOW_END;
          return yield* this.parseLineStart();
        }
      }
      let n = 0;
      while (line[n] === ",") {
        n += yield* this.pushCount(1);
        n += yield* this.pushSpaces(true);
        this.flowKey = false;
      }
      n += yield* this.pushIndicators();
      switch (line[n]) {
        case undefined:
          return "flow";
        case "#":
          yield* this.pushCount(line.length - n);
          return "flow";
        case "{":
        case "[":
          yield* this.pushCount(1);
          this.flowKey = false;
          this.flowLevel += 1;
          return "flow";
        case "}":
        case "]":
          yield* this.pushCount(1);
          this.flowKey = true;
          this.flowLevel -= 1;
          return this.flowLevel ? "flow" : "doc";
        case "*":
          yield* this.pushUntil(isNotAnchorChar);
          return "flow";
        case '"':
        case "'":
          this.flowKey = true;
          return yield* this.parseQuotedScalar();
        case ":": {
          const next = this.charAt(1);
          if (this.flowKey || isEmpty(next) || next === ",") {
            this.flowKey = false;
            yield* this.pushCount(1);
            yield* this.pushSpaces(true);
            return "flow";
          }
        }
        default:
          this.flowKey = false;
          return yield* this.parsePlainScalar();
      }
    }
    *parseQuotedScalar() {
      const quote = this.charAt(0);
      let end = this.buffer.indexOf(quote, this.pos + 1);
      if (quote === "'") {
        while (end !== -1 && this.buffer[end + 1] === "'")
          end = this.buffer.indexOf("'", end + 2);
      } else {
        while (end !== -1) {
          let n = 0;
          while (this.buffer[end - 1 - n] === "\\")
            n += 1;
          if (n % 2 === 0)
            break;
          end = this.buffer.indexOf('"', end + 1);
        }
      }
      const qb = this.buffer.substring(0, end);
      let nl = qb.indexOf(`
`, this.pos);
      if (nl !== -1) {
        while (nl !== -1) {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = qb.indexOf(`
`, cs);
        }
        if (nl !== -1) {
          end = nl - (qb[nl - 1] === "\r" ? 2 : 1);
        }
      }
      if (end === -1) {
        if (!this.atEnd)
          return this.setNext("quoted-scalar");
        end = this.buffer.length;
      }
      yield* this.pushToIndex(end + 1, false);
      return this.flowLevel ? "flow" : "doc";
    }
    *parseBlockScalarHeader() {
      this.blockScalarIndent = -1;
      this.blockScalarKeep = false;
      let i = this.pos;
      while (true) {
        const ch = this.buffer[++i];
        if (ch === "+")
          this.blockScalarKeep = true;
        else if (ch > "0" && ch <= "9")
          this.blockScalarIndent = Number(ch) - 1;
        else if (ch !== "-")
          break;
      }
      return yield* this.pushUntil((ch) => isEmpty(ch) || ch === "#");
    }
    *parseBlockScalar() {
      let nl = this.pos - 1;
      let indent = 0;
      let ch;
      loop:
        for (let i2 = this.pos;ch = this.buffer[i2]; ++i2) {
          switch (ch) {
            case " ":
              indent += 1;
              break;
            case `
`:
              nl = i2;
              indent = 0;
              break;
            case "\r": {
              const next = this.buffer[i2 + 1];
              if (!next && !this.atEnd)
                return this.setNext("block-scalar");
              if (next === `
`)
                break;
            }
            default:
              break loop;
          }
        }
      if (!ch && !this.atEnd)
        return this.setNext("block-scalar");
      if (indent >= this.indentNext) {
        if (this.blockScalarIndent === -1)
          this.indentNext = indent;
        else {
          this.indentNext = this.blockScalarIndent + (this.indentNext === 0 ? 1 : this.indentNext);
        }
        do {
          const cs = this.continueScalar(nl + 1);
          if (cs === -1)
            break;
          nl = this.buffer.indexOf(`
`, cs);
        } while (nl !== -1);
        if (nl === -1) {
          if (!this.atEnd)
            return this.setNext("block-scalar");
          nl = this.buffer.length;
        }
      }
      let i = nl + 1;
      ch = this.buffer[i];
      while (ch === " ")
        ch = this.buffer[++i];
      if (ch === "\t") {
        while (ch === "\t" || ch === " " || ch === "\r" || ch === `
`)
          ch = this.buffer[++i];
        nl = i - 1;
      } else if (!this.blockScalarKeep) {
        do {
          let i2 = nl - 1;
          let ch2 = this.buffer[i2];
          if (ch2 === "\r")
            ch2 = this.buffer[--i2];
          const lastChar = i2;
          while (ch2 === " ")
            ch2 = this.buffer[--i2];
          if (ch2 === `
` && i2 >= this.pos && i2 + 1 + indent > lastChar)
            nl = i2;
          else
            break;
        } while (true);
      }
      yield cst.SCALAR;
      yield* this.pushToIndex(nl + 1, true);
      return yield* this.parseLineStart();
    }
    *parsePlainScalar() {
      const inFlow = this.flowLevel > 0;
      let end = this.pos - 1;
      let i = this.pos - 1;
      let ch;
      while (ch = this.buffer[++i]) {
        if (ch === ":") {
          const next = this.buffer[i + 1];
          if (isEmpty(next) || inFlow && flowIndicatorChars.has(next))
            break;
          end = i;
        } else if (isEmpty(ch)) {
          let next = this.buffer[i + 1];
          if (ch === "\r") {
            if (next === `
`) {
              i += 1;
              ch = `
`;
              next = this.buffer[i + 1];
            } else
              end = i;
          }
          if (next === "#" || inFlow && flowIndicatorChars.has(next))
            break;
          if (ch === `
`) {
            const cs = this.continueScalar(i + 1);
            if (cs === -1)
              break;
            i = Math.max(i, cs - 2);
          }
        } else {
          if (inFlow && flowIndicatorChars.has(ch))
            break;
          end = i;
        }
      }
      if (!ch && !this.atEnd)
        return this.setNext("plain-scalar");
      yield cst.SCALAR;
      yield* this.pushToIndex(end + 1, true);
      return inFlow ? "flow" : "doc";
    }
    *pushCount(n) {
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos += n;
        return n;
      }
      return 0;
    }
    *pushToIndex(i, allowEmpty) {
      const s = this.buffer.slice(this.pos, i);
      if (s) {
        yield s;
        this.pos += s.length;
        return s.length;
      } else if (allowEmpty)
        yield "";
      return 0;
    }
    *pushIndicators() {
      switch (this.charAt(0)) {
        case "!":
          return (yield* this.pushTag()) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
        case "&":
          return (yield* this.pushUntil(isNotAnchorChar)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
        case "-":
        case "?":
        case ":": {
          const inFlow = this.flowLevel > 0;
          const ch1 = this.charAt(1);
          if (isEmpty(ch1) || inFlow && flowIndicatorChars.has(ch1)) {
            if (!inFlow)
              this.indentNext = this.indentValue + 1;
            else if (this.flowKey)
              this.flowKey = false;
            return (yield* this.pushCount(1)) + (yield* this.pushSpaces(true)) + (yield* this.pushIndicators());
          }
        }
      }
      return 0;
    }
    *pushTag() {
      if (this.charAt(1) === "<") {
        let i = this.pos + 2;
        let ch = this.buffer[i];
        while (!isEmpty(ch) && ch !== ">")
          ch = this.buffer[++i];
        return yield* this.pushToIndex(ch === ">" ? i + 1 : i, false);
      } else {
        let i = this.pos + 1;
        let ch = this.buffer[i];
        while (ch) {
          if (tagChars.has(ch))
            ch = this.buffer[++i];
          else if (ch === "%" && hexDigits.has(this.buffer[i + 1]) && hexDigits.has(this.buffer[i + 2])) {
            ch = this.buffer[i += 3];
          } else
            break;
        }
        return yield* this.pushToIndex(i, false);
      }
    }
    *pushNewline() {
      const ch = this.buffer[this.pos];
      if (ch === `
`)
        return yield* this.pushCount(1);
      else if (ch === "\r" && this.charAt(1) === `
`)
        return yield* this.pushCount(2);
      else
        return 0;
    }
    *pushSpaces(allowTabs) {
      let i = this.pos - 1;
      let ch;
      do {
        ch = this.buffer[++i];
      } while (ch === " " || allowTabs && ch === "\t");
      const n = i - this.pos;
      if (n > 0) {
        yield this.buffer.substr(this.pos, n);
        this.pos = i;
      }
      return n;
    }
    *pushUntil(test) {
      let i = this.pos;
      let ch = this.buffer[i];
      while (!test(ch))
        ch = this.buffer[++i];
      return yield* this.pushToIndex(i, false);
    }
  }
  exports.Lexer = Lexer;
});

// node_modules/yaml/dist/parse/line-counter.js
var require_line_counter = __commonJS((exports) => {
  class LineCounter {
    constructor() {
      this.lineStarts = [];
      this.addNewLine = (offset) => this.lineStarts.push(offset);
      this.linePos = (offset) => {
        let low = 0;
        let high = this.lineStarts.length;
        while (low < high) {
          const mid = low + high >> 1;
          if (this.lineStarts[mid] < offset)
            low = mid + 1;
          else
            high = mid;
        }
        if (this.lineStarts[low] === offset)
          return { line: low + 1, col: 1 };
        if (low === 0)
          return { line: 0, col: offset };
        const start = this.lineStarts[low - 1];
        return { line: low, col: offset - start + 1 };
      };
    }
  }
  exports.LineCounter = LineCounter;
});

// node_modules/yaml/dist/parse/parser.js
var require_parser = __commonJS((exports) => {
  var node_process = __require("process");
  var cst = require_cst();
  var lexer = require_lexer();
  function includesToken(list, type) {
    for (let i = 0;i < list.length; ++i)
      if (list[i].type === type)
        return true;
    return false;
  }
  function findNonEmptyIndex(list) {
    for (let i = 0;i < list.length; ++i) {
      switch (list[i].type) {
        case "space":
        case "comment":
        case "newline":
          break;
        default:
          return i;
      }
    }
    return -1;
  }
  function isFlowToken(token) {
    switch (token?.type) {
      case "alias":
      case "scalar":
      case "single-quoted-scalar":
      case "double-quoted-scalar":
      case "flow-collection":
        return true;
      default:
        return false;
    }
  }
  function getPrevProps(parent) {
    switch (parent.type) {
      case "document":
        return parent.start;
      case "block-map": {
        const it = parent.items[parent.items.length - 1];
        return it.sep ?? it.start;
      }
      case "block-seq":
        return parent.items[parent.items.length - 1].start;
      default:
        return [];
    }
  }
  function getFirstKeyStartProps(prev) {
    if (prev.length === 0)
      return [];
    let i = prev.length;
    loop:
      while (--i >= 0) {
        switch (prev[i].type) {
          case "doc-start":
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
          case "newline":
            break loop;
        }
      }
    while (prev[++i]?.type === "space") {}
    return prev.splice(i, prev.length);
  }
  function fixFlowSeqItems(fc) {
    if (fc.start.type === "flow-seq-start") {
      for (const it of fc.items) {
        if (it.sep && !it.value && !includesToken(it.start, "explicit-key-ind") && !includesToken(it.sep, "map-value-ind")) {
          if (it.key)
            it.value = it.key;
          delete it.key;
          if (isFlowToken(it.value)) {
            if (it.value.end)
              Array.prototype.push.apply(it.value.end, it.sep);
            else
              it.value.end = it.sep;
          } else
            Array.prototype.push.apply(it.start, it.sep);
          delete it.sep;
        }
      }
    }
  }

  class Parser {
    constructor(onNewLine) {
      this.atNewLine = true;
      this.atScalar = false;
      this.indent = 0;
      this.offset = 0;
      this.onKeyLine = false;
      this.stack = [];
      this.source = "";
      this.type = "";
      this.lexer = new lexer.Lexer;
      this.onNewLine = onNewLine;
    }
    *parse(source, incomplete = false) {
      if (this.onNewLine && this.offset === 0)
        this.onNewLine(0);
      for (const lexeme of this.lexer.lex(source, incomplete))
        yield* this.next(lexeme);
      if (!incomplete)
        yield* this.end();
    }
    *next(source) {
      this.source = source;
      if (node_process.env.LOG_TOKENS)
        console.log("|", cst.prettyToken(source));
      if (this.atScalar) {
        this.atScalar = false;
        yield* this.step();
        this.offset += source.length;
        return;
      }
      const type = cst.tokenType(source);
      if (!type) {
        const message = `Not a YAML token: ${source}`;
        yield* this.pop({ type: "error", offset: this.offset, message, source });
        this.offset += source.length;
      } else if (type === "scalar") {
        this.atNewLine = false;
        this.atScalar = true;
        this.type = "scalar";
      } else {
        this.type = type;
        yield* this.step();
        switch (type) {
          case "newline":
            this.atNewLine = true;
            this.indent = 0;
            if (this.onNewLine)
              this.onNewLine(this.offset + source.length);
            break;
          case "space":
            if (this.atNewLine && source[0] === " ")
              this.indent += source.length;
            break;
          case "explicit-key-ind":
          case "map-value-ind":
          case "seq-item-ind":
            if (this.atNewLine)
              this.indent += source.length;
            break;
          case "doc-mode":
          case "flow-error-end":
            return;
          default:
            this.atNewLine = false;
        }
        this.offset += source.length;
      }
    }
    *end() {
      while (this.stack.length > 0)
        yield* this.pop();
    }
    get sourceToken() {
      const st = {
        type: this.type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
      return st;
    }
    *step() {
      const top = this.peek(1);
      if (this.type === "doc-end" && top?.type !== "doc-end") {
        while (this.stack.length > 0)
          yield* this.pop();
        this.stack.push({
          type: "doc-end",
          offset: this.offset,
          source: this.source
        });
        return;
      }
      if (!top)
        return yield* this.stream();
      switch (top.type) {
        case "document":
          return yield* this.document(top);
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return yield* this.scalar(top);
        case "block-scalar":
          return yield* this.blockScalar(top);
        case "block-map":
          return yield* this.blockMap(top);
        case "block-seq":
          return yield* this.blockSequence(top);
        case "flow-collection":
          return yield* this.flowCollection(top);
        case "doc-end":
          return yield* this.documentEnd(top);
      }
      yield* this.pop();
    }
    peek(n) {
      return this.stack[this.stack.length - n];
    }
    *pop(error) {
      const token = error ?? this.stack.pop();
      if (!token) {
        const message = "Tried to pop an empty stack";
        yield { type: "error", offset: this.offset, source: "", message };
      } else if (this.stack.length === 0) {
        yield token;
      } else {
        const top = this.peek(1);
        if (token.type === "block-scalar") {
          token.indent = "indent" in top ? top.indent : 0;
        } else if (token.type === "flow-collection" && top.type === "document") {
          token.indent = 0;
        }
        if (token.type === "flow-collection")
          fixFlowSeqItems(token);
        switch (top.type) {
          case "document":
            top.value = token;
            break;
          case "block-scalar":
            top.props.push(token);
            break;
          case "block-map": {
            const it = top.items[top.items.length - 1];
            if (it.value) {
              top.items.push({ start: [], key: token, sep: [] });
              this.onKeyLine = true;
              return;
            } else if (it.sep) {
              it.value = token;
            } else {
              Object.assign(it, { key: token, sep: [] });
              this.onKeyLine = !it.explicitKey;
              return;
            }
            break;
          }
          case "block-seq": {
            const it = top.items[top.items.length - 1];
            if (it.value)
              top.items.push({ start: [], value: token });
            else
              it.value = token;
            break;
          }
          case "flow-collection": {
            const it = top.items[top.items.length - 1];
            if (!it || it.value)
              top.items.push({ start: [], key: token, sep: [] });
            else if (it.sep)
              it.value = token;
            else
              Object.assign(it, { key: token, sep: [] });
            return;
          }
          default:
            yield* this.pop();
            yield* this.pop(token);
        }
        if ((top.type === "document" || top.type === "block-map" || top.type === "block-seq") && (token.type === "block-map" || token.type === "block-seq")) {
          const last = token.items[token.items.length - 1];
          if (last && !last.sep && !last.value && last.start.length > 0 && findNonEmptyIndex(last.start) === -1 && (token.indent === 0 || last.start.every((st) => st.type !== "comment" || st.indent < token.indent))) {
            if (top.type === "document")
              top.end = last.start;
            else
              top.items.push({ start: last.start });
            token.items.splice(-1, 1);
          }
        }
      }
    }
    *stream() {
      switch (this.type) {
        case "directive-line":
          yield { type: "directive", offset: this.offset, source: this.source };
          return;
        case "byte-order-mark":
        case "space":
        case "comment":
        case "newline":
          yield this.sourceToken;
          return;
        case "doc-mode":
        case "doc-start": {
          const doc = {
            type: "document",
            offset: this.offset,
            start: []
          };
          if (this.type === "doc-start")
            doc.start.push(this.sourceToken);
          this.stack.push(doc);
          return;
        }
      }
      yield {
        type: "error",
        offset: this.offset,
        message: `Unexpected ${this.type} token in YAML stream`,
        source: this.source
      };
    }
    *document(doc) {
      if (doc.value)
        return yield* this.lineEnd(doc);
      switch (this.type) {
        case "doc-start": {
          if (findNonEmptyIndex(doc.start) !== -1) {
            yield* this.pop();
            yield* this.step();
          } else
            doc.start.push(this.sourceToken);
          return;
        }
        case "anchor":
        case "tag":
        case "space":
        case "comment":
        case "newline":
          doc.start.push(this.sourceToken);
          return;
      }
      const bv = this.startBlockValue(doc);
      if (bv)
        this.stack.push(bv);
      else {
        yield {
          type: "error",
          offset: this.offset,
          message: `Unexpected ${this.type} token in YAML document`,
          source: this.source
        };
      }
    }
    *scalar(scalar) {
      if (this.type === "map-value-ind") {
        const prev = getPrevProps(this.peek(2));
        const start = getFirstKeyStartProps(prev);
        let sep;
        if (scalar.end) {
          sep = scalar.end;
          sep.push(this.sourceToken);
          delete scalar.end;
        } else
          sep = [this.sourceToken];
        const map = {
          type: "block-map",
          offset: scalar.offset,
          indent: scalar.indent,
          items: [{ start, key: scalar, sep }]
        };
        this.onKeyLine = true;
        this.stack[this.stack.length - 1] = map;
      } else
        yield* this.lineEnd(scalar);
    }
    *blockScalar(scalar) {
      switch (this.type) {
        case "space":
        case "comment":
        case "newline":
          scalar.props.push(this.sourceToken);
          return;
        case "scalar":
          scalar.source = this.source;
          this.atNewLine = true;
          this.indent = 0;
          if (this.onNewLine) {
            let nl = this.source.indexOf(`
`) + 1;
            while (nl !== 0) {
              this.onNewLine(this.offset + nl);
              nl = this.source.indexOf(`
`, nl) + 1;
            }
          }
          yield* this.pop();
          break;
        default:
          yield* this.pop();
          yield* this.step();
      }
    }
    *blockMap(map) {
      const it = map.items[map.items.length - 1];
      switch (this.type) {
        case "newline":
          this.onKeyLine = false;
          if (it.value) {
            const end = "end" in it.value ? it.value.end : undefined;
            const last = Array.isArray(end) ? end[end.length - 1] : undefined;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              map.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            it.start.push(this.sourceToken);
          }
          return;
        case "space":
        case "comment":
          if (it.value) {
            map.items.push({ start: [this.sourceToken] });
          } else if (it.sep) {
            it.sep.push(this.sourceToken);
          } else {
            if (this.atIndentedComment(it.start, map.indent)) {
              const prev = map.items[map.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                Array.prototype.push.apply(end, it.start);
                end.push(this.sourceToken);
                map.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
      }
      if (this.indent >= map.indent) {
        const atMapIndent = !this.onKeyLine && this.indent === map.indent;
        const atNextItem = atMapIndent && (it.sep || it.explicitKey) && this.type !== "seq-item-ind";
        let start = [];
        if (atNextItem && it.sep && !it.value) {
          const nl = [];
          for (let i = 0;i < it.sep.length; ++i) {
            const st = it.sep[i];
            switch (st.type) {
              case "newline":
                nl.push(i);
                break;
              case "space":
                break;
              case "comment":
                if (st.indent > map.indent)
                  nl.length = 0;
                break;
              default:
                nl.length = 0;
            }
          }
          if (nl.length >= 2)
            start = it.sep.splice(nl[1]);
        }
        switch (this.type) {
          case "anchor":
          case "tag":
            if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map.items.push({ start });
              this.onKeyLine = true;
            } else if (it.sep) {
              it.sep.push(this.sourceToken);
            } else {
              it.start.push(this.sourceToken);
            }
            return;
          case "explicit-key-ind":
            if (!it.sep && !it.explicitKey) {
              it.start.push(this.sourceToken);
              it.explicitKey = true;
            } else if (atNextItem || it.value) {
              start.push(this.sourceToken);
              map.items.push({ start, explicitKey: true });
            } else {
              this.stack.push({
                type: "block-map",
                offset: this.offset,
                indent: this.indent,
                items: [{ start: [this.sourceToken], explicitKey: true }]
              });
            }
            this.onKeyLine = true;
            return;
          case "map-value-ind":
            if (it.explicitKey) {
              if (!it.sep) {
                if (includesToken(it.start, "newline")) {
                  Object.assign(it, { key: null, sep: [this.sourceToken] });
                } else {
                  const start2 = getFirstKeyStartProps(it.start);
                  this.stack.push({
                    type: "block-map",
                    offset: this.offset,
                    indent: this.indent,
                    items: [{ start: start2, key: null, sep: [this.sourceToken] }]
                  });
                }
              } else if (it.value) {
                map.items.push({ start: [], key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start, key: null, sep: [this.sourceToken] }]
                });
              } else if (isFlowToken(it.key) && !includesToken(it.sep, "newline")) {
                const start2 = getFirstKeyStartProps(it.start);
                const key = it.key;
                const sep = it.sep;
                sep.push(this.sourceToken);
                delete it.key;
                delete it.sep;
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: start2, key, sep }]
                });
              } else if (start.length > 0) {
                it.sep = it.sep.concat(start, this.sourceToken);
              } else {
                it.sep.push(this.sourceToken);
              }
            } else {
              if (!it.sep) {
                Object.assign(it, { key: null, sep: [this.sourceToken] });
              } else if (it.value || atNextItem) {
                map.items.push({ start, key: null, sep: [this.sourceToken] });
              } else if (includesToken(it.sep, "map-value-ind")) {
                this.stack.push({
                  type: "block-map",
                  offset: this.offset,
                  indent: this.indent,
                  items: [{ start: [], key: null, sep: [this.sourceToken] }]
                });
              } else {
                it.sep.push(this.sourceToken);
              }
            }
            this.onKeyLine = true;
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (atNextItem || it.value) {
              map.items.push({ start, key: fs, sep: [] });
              this.onKeyLine = true;
            } else if (it.sep) {
              this.stack.push(fs);
            } else {
              Object.assign(it, { key: fs, sep: [] });
              this.onKeyLine = true;
            }
            return;
          }
          default: {
            const bv = this.startBlockValue(map);
            if (bv) {
              if (bv.type === "block-seq") {
                if (!it.explicitKey && it.sep && !includesToken(it.sep, "newline")) {
                  yield* this.pop({
                    type: "error",
                    offset: this.offset,
                    message: "Unexpected block-seq-ind on same line with key",
                    source: this.source
                  });
                  return;
                }
              } else if (atMapIndent) {
                map.items.push({ start });
              }
              this.stack.push(bv);
              return;
            }
          }
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *blockSequence(seq) {
      const it = seq.items[seq.items.length - 1];
      switch (this.type) {
        case "newline":
          if (it.value) {
            const end = "end" in it.value ? it.value.end : undefined;
            const last = Array.isArray(end) ? end[end.length - 1] : undefined;
            if (last?.type === "comment")
              end?.push(this.sourceToken);
            else
              seq.items.push({ start: [this.sourceToken] });
          } else
            it.start.push(this.sourceToken);
          return;
        case "space":
        case "comment":
          if (it.value)
            seq.items.push({ start: [this.sourceToken] });
          else {
            if (this.atIndentedComment(it.start, seq.indent)) {
              const prev = seq.items[seq.items.length - 2];
              const end = prev?.value?.end;
              if (Array.isArray(end)) {
                Array.prototype.push.apply(end, it.start);
                end.push(this.sourceToken);
                seq.items.pop();
                return;
              }
            }
            it.start.push(this.sourceToken);
          }
          return;
        case "anchor":
        case "tag":
          if (it.value || this.indent <= seq.indent)
            break;
          it.start.push(this.sourceToken);
          return;
        case "seq-item-ind":
          if (this.indent !== seq.indent)
            break;
          if (it.value || includesToken(it.start, "seq-item-ind"))
            seq.items.push({ start: [this.sourceToken] });
          else
            it.start.push(this.sourceToken);
          return;
      }
      if (this.indent > seq.indent) {
        const bv = this.startBlockValue(seq);
        if (bv) {
          this.stack.push(bv);
          return;
        }
      }
      yield* this.pop();
      yield* this.step();
    }
    *flowCollection(fc) {
      const it = fc.items[fc.items.length - 1];
      if (this.type === "flow-error-end") {
        let top;
        do {
          yield* this.pop();
          top = this.peek(1);
        } while (top?.type === "flow-collection");
      } else if (fc.end.length === 0) {
        switch (this.type) {
          case "comma":
          case "explicit-key-ind":
            if (!it || it.sep)
              fc.items.push({ start: [this.sourceToken] });
            else
              it.start.push(this.sourceToken);
            return;
          case "map-value-ind":
            if (!it || it.value)
              fc.items.push({ start: [], key: null, sep: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              Object.assign(it, { key: null, sep: [this.sourceToken] });
            return;
          case "space":
          case "comment":
          case "newline":
          case "anchor":
          case "tag":
            if (!it || it.value)
              fc.items.push({ start: [this.sourceToken] });
            else if (it.sep)
              it.sep.push(this.sourceToken);
            else
              it.start.push(this.sourceToken);
            return;
          case "alias":
          case "scalar":
          case "single-quoted-scalar":
          case "double-quoted-scalar": {
            const fs = this.flowScalar(this.type);
            if (!it || it.value)
              fc.items.push({ start: [], key: fs, sep: [] });
            else if (it.sep)
              this.stack.push(fs);
            else
              Object.assign(it, { key: fs, sep: [] });
            return;
          }
          case "flow-map-end":
          case "flow-seq-end":
            fc.end.push(this.sourceToken);
            return;
        }
        const bv = this.startBlockValue(fc);
        if (bv)
          this.stack.push(bv);
        else {
          yield* this.pop();
          yield* this.step();
        }
      } else {
        const parent = this.peek(2);
        if (parent.type === "block-map" && (this.type === "map-value-ind" && parent.indent === fc.indent || this.type === "newline" && !parent.items[parent.items.length - 1].sep)) {
          yield* this.pop();
          yield* this.step();
        } else if (this.type === "map-value-ind" && parent.type !== "flow-collection") {
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          fixFlowSeqItems(fc);
          const sep = fc.end.splice(1, fc.end.length);
          sep.push(this.sourceToken);
          const map = {
            type: "block-map",
            offset: fc.offset,
            indent: fc.indent,
            items: [{ start, key: fc, sep }]
          };
          this.onKeyLine = true;
          this.stack[this.stack.length - 1] = map;
        } else {
          yield* this.lineEnd(fc);
        }
      }
    }
    flowScalar(type) {
      if (this.onNewLine) {
        let nl = this.source.indexOf(`
`) + 1;
        while (nl !== 0) {
          this.onNewLine(this.offset + nl);
          nl = this.source.indexOf(`
`, nl) + 1;
        }
      }
      return {
        type,
        offset: this.offset,
        indent: this.indent,
        source: this.source
      };
    }
    startBlockValue(parent) {
      switch (this.type) {
        case "alias":
        case "scalar":
        case "single-quoted-scalar":
        case "double-quoted-scalar":
          return this.flowScalar(this.type);
        case "block-scalar-header":
          return {
            type: "block-scalar",
            offset: this.offset,
            indent: this.indent,
            props: [this.sourceToken],
            source: ""
          };
        case "flow-map-start":
        case "flow-seq-start":
          return {
            type: "flow-collection",
            offset: this.offset,
            indent: this.indent,
            start: this.sourceToken,
            items: [],
            end: []
          };
        case "seq-item-ind":
          return {
            type: "block-seq",
            offset: this.offset,
            indent: this.indent,
            items: [{ start: [this.sourceToken] }]
          };
        case "explicit-key-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          start.push(this.sourceToken);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, explicitKey: true }]
          };
        }
        case "map-value-ind": {
          this.onKeyLine = true;
          const prev = getPrevProps(parent);
          const start = getFirstKeyStartProps(prev);
          return {
            type: "block-map",
            offset: this.offset,
            indent: this.indent,
            items: [{ start, key: null, sep: [this.sourceToken] }]
          };
        }
      }
      return null;
    }
    atIndentedComment(start, indent) {
      if (this.type !== "comment")
        return false;
      if (this.indent <= indent)
        return false;
      return start.every((st) => st.type === "newline" || st.type === "space");
    }
    *documentEnd(docEnd) {
      if (this.type !== "doc-mode") {
        if (docEnd.end)
          docEnd.end.push(this.sourceToken);
        else
          docEnd.end = [this.sourceToken];
        if (this.type === "newline")
          yield* this.pop();
      }
    }
    *lineEnd(token) {
      switch (this.type) {
        case "comma":
        case "doc-start":
        case "doc-end":
        case "flow-seq-end":
        case "flow-map-end":
        case "map-value-ind":
          yield* this.pop();
          yield* this.step();
          break;
        case "newline":
          this.onKeyLine = false;
        case "space":
        case "comment":
        default:
          if (token.end)
            token.end.push(this.sourceToken);
          else
            token.end = [this.sourceToken];
          if (this.type === "newline")
            yield* this.pop();
      }
    }
  }
  exports.Parser = Parser;
});

// node_modules/yaml/dist/public-api.js
var require_public_api = __commonJS((exports) => {
  var composer = require_composer();
  var Document = require_Document();
  var errors = require_errors();
  var log = require_log();
  var identity = require_identity();
  var lineCounter = require_line_counter();
  var parser = require_parser();
  function parseOptions(options) {
    const prettyErrors = options.prettyErrors !== false;
    const lineCounter$1 = options.lineCounter || prettyErrors && new lineCounter.LineCounter || null;
    return { lineCounter: lineCounter$1, prettyErrors };
  }
  function parseAllDocuments(source, options = {}) {
    const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
    const composer$1 = new composer.Composer(options);
    const docs = Array.from(composer$1.compose(parser$1.parse(source)));
    if (prettyErrors && lineCounter2)
      for (const doc of docs) {
        doc.errors.forEach(errors.prettifyError(source, lineCounter2));
        doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
      }
    if (docs.length > 0)
      return docs;
    return Object.assign([], { empty: true }, composer$1.streamInfo());
  }
  function parseDocument(source, options = {}) {
    const { lineCounter: lineCounter2, prettyErrors } = parseOptions(options);
    const parser$1 = new parser.Parser(lineCounter2?.addNewLine);
    const composer$1 = new composer.Composer(options);
    let doc = null;
    for (const _doc of composer$1.compose(parser$1.parse(source), true, source.length)) {
      if (!doc)
        doc = _doc;
      else if (doc.options.logLevel !== "silent") {
        doc.errors.push(new errors.YAMLParseError(_doc.range.slice(0, 2), "MULTIPLE_DOCS", "Source contains multiple documents; please use YAML.parseAllDocuments()"));
        break;
      }
    }
    if (prettyErrors && lineCounter2) {
      doc.errors.forEach(errors.prettifyError(source, lineCounter2));
      doc.warnings.forEach(errors.prettifyError(source, lineCounter2));
    }
    return doc;
  }
  function parse(src, reviver, options) {
    let _reviver = undefined;
    if (typeof reviver === "function") {
      _reviver = reviver;
    } else if (options === undefined && reviver && typeof reviver === "object") {
      options = reviver;
    }
    const doc = parseDocument(src, options);
    if (!doc)
      return null;
    doc.warnings.forEach((warning) => log.warn(doc.options.logLevel, warning));
    if (doc.errors.length > 0) {
      if (doc.options.logLevel !== "silent")
        throw doc.errors[0];
      else
        doc.errors = [];
    }
    return doc.toJS(Object.assign({ reviver: _reviver }, options));
  }
  function stringify(value, replacer, options) {
    let _replacer = null;
    if (typeof replacer === "function" || Array.isArray(replacer)) {
      _replacer = replacer;
    } else if (options === undefined && replacer) {
      options = replacer;
    }
    if (typeof options === "string")
      options = options.length;
    if (typeof options === "number") {
      const indent = Math.round(options);
      options = indent < 1 ? undefined : indent > 8 ? { indent: 8 } : { indent };
    }
    if (value === undefined) {
      const { keepUndefined } = options ?? replacer ?? {};
      if (!keepUndefined)
        return;
    }
    if (identity.isDocument(value) && !_replacer)
      return value.toString(options);
    return new Document.Document(value, _replacer, options).toString(options);
  }
  exports.parse = parse;
  exports.parseAllDocuments = parseAllDocuments;
  exports.parseDocument = parseDocument;
  exports.stringify = stringify;
});

// node_modules/yaml/dist/index.js
var require_dist = __commonJS((exports) => {
  var composer = require_composer();
  var Document = require_Document();
  var Schema = require_Schema();
  var errors = require_errors();
  var Alias = require_Alias();
  var identity = require_identity();
  var Pair = require_Pair();
  var Scalar = require_Scalar();
  var YAMLMap = require_YAMLMap();
  var YAMLSeq = require_YAMLSeq();
  var cst = require_cst();
  var lexer = require_lexer();
  var lineCounter = require_line_counter();
  var parser = require_parser();
  var publicApi = require_public_api();
  var visit = require_visit();
  exports.Composer = composer.Composer;
  exports.Document = Document.Document;
  exports.Schema = Schema.Schema;
  exports.YAMLError = errors.YAMLError;
  exports.YAMLParseError = errors.YAMLParseError;
  exports.YAMLWarning = errors.YAMLWarning;
  exports.Alias = Alias.Alias;
  exports.isAlias = identity.isAlias;
  exports.isCollection = identity.isCollection;
  exports.isDocument = identity.isDocument;
  exports.isMap = identity.isMap;
  exports.isNode = identity.isNode;
  exports.isPair = identity.isPair;
  exports.isScalar = identity.isScalar;
  exports.isSeq = identity.isSeq;
  exports.Pair = Pair.Pair;
  exports.Scalar = Scalar.Scalar;
  exports.YAMLMap = YAMLMap.YAMLMap;
  exports.YAMLSeq = YAMLSeq.YAMLSeq;
  exports.CST = cst;
  exports.Lexer = lexer.Lexer;
  exports.LineCounter = lineCounter.LineCounter;
  exports.Parser = parser.Parser;
  exports.parse = publicApi.parse;
  exports.parseAllDocuments = publicApi.parseAllDocuments;
  exports.parseDocument = publicApi.parseDocument;
  exports.stringify = publicApi.stringify;
  exports.visit = visit.visit;
  exports.visitAsync = visit.visitAsync;
});

// src/commands/auth.ts
var exports_auth = {};
__export(exports_auth, {
  validateToken: () => validateToken,
  updateUserPermissions: () => updateUserPermissions,
  saveAuthData: () => saveAuthData,
  revokeToken: () => revokeToken,
  revokeAllTokens: () => revokeAllTokens,
  renewToken: () => renewToken,
  removeUser: () => removeUser,
  rejectRequest: () => rejectRequest,
  loadAuthData: () => loadAuthData,
  listUsers: () => listUsers,
  listTokens: () => listTokens,
  listPendingApprovals: () => listPendingApprovals,
  isTrustedUser: () => isTrustedUser,
  isLoginApprovalRequired: () => isLoginApprovalRequired,
  isCurrentUserAdmin: () => isCurrentUserAdmin,
  hasPermission: () => hasPermission,
  getUser: () => getUser,
  getAdminUser: () => getAdminUser,
  generateToken: () => generateToken,
  generateAdminToken: () => generateAdminToken,
  createPendingApproval: () => createPendingApproval,
  checkApprovalStatus: () => checkApprovalStatus,
  approveRequest: () => approveRequest,
  addUser: () => addUser
});
import { homedir } from "os";
import { join as join2 } from "path";
import { existsSync } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { randomBytes, createHmac } from "crypto";
async function loadAuthData() {
  try {
    if (existsSync(AUTH_FILE)) {
      const content = await readFile(AUTH_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch {}
  const adminUser = process.env.SUDO_USER || process.env.USER || "root";
  const secret = randomBytes(32).toString("hex");
  return {
    admin: adminUser,
    secret,
    users: [],
    tokens: [],
    pendingApprovals: []
  };
}
async function saveAuthData(data) {
  const dir = join2(homedir(), ".okastr8");
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  await writeFile(AUTH_FILE, JSON.stringify(data, null, 2));
}
function parseExpiry(expiry) {
  const match = expiry.match(/^(\d+)(m|h|d|w)$/);
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid expiry format: ${expiry}. Use: 30m, 1h, 1d, 1w, 30d`);
  }
  const value = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };
  return value * (multipliers[unit] || 0);
}
async function generateToken(userId, permissions, expiry = "1d") {
  const data = await loadAuthData();
  const durationMs = parseExpiry(expiry);
  const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
  if (durationMs > MAX_DURATION_MS) {
    throw new Error("Security restriction: Token duration cannot exceed 24 hours (1d).");
  }
  const tokenId = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const payload = {
    id: tokenId,
    sub: userId,
    perm: permissions,
    exp: expiresAt
  };
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadStr).toString("base64url");
  const signature = createHmac("sha256", data.secret).update(payloadB64).digest("base64url");
  const token = `${payloadB64}.${signature}`;
  const now = new Date;
  data.tokens = data.tokens.filter((t) => new Date(t.expiresAt) > now);
  data.tokens = data.tokens.filter((t) => t.userId !== userId);
  data.tokens.push({
    id: tokenId,
    userId,
    permissions,
    expiresAt,
    createdAt: now.toISOString()
  });
  await saveAuthData(data);
  return { token, expiresAt };
}
async function validateToken(token) {
  try {
    const data = await loadAuthData();
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { valid: false, error: "Invalid token format" };
    }
    const payloadB64 = parts[0];
    const signature = parts[1];
    const expectedSig = createHmac("sha256", data.secret).update(payloadB64).digest("base64url");
    if (signature !== expectedSig) {
      return { valid: false, error: "Invalid signature" };
    }
    const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const payload = JSON.parse(payloadStr);
    if (new Date(payload.exp) < new Date) {
      return { valid: false, error: "Token expired" };
    }
    const tokenRecord = data.tokens.find((t) => t.id === payload.id);
    if (!tokenRecord) {
      return { valid: false, error: "Token revoked or not found" };
    }
    return {
      valid: true,
      userId: payload.sub,
      permissions: payload.perm
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
async function renewToken(userId, duration) {
  const data = await loadAuthData();
  const ms = parseExpiry(duration);
  const tokenIdx = data.tokens.findIndex((t) => t.userId === userId);
  if (tokenIdx === -1) {
    return { success: false, error: "No token found for user" };
  }
  const newExpiry = new Date(Date.now() + ms).toISOString();
  if (data.tokens[tokenIdx]) {
    data.tokens[tokenIdx].expiresAt = newExpiry;
  }
  await saveAuthData(data);
  return { success: true, expiresAt: newExpiry };
}
async function revokeToken(tokenId) {
  const data = await loadAuthData();
  const initialLength = data.tokens.length;
  data.tokens = data.tokens.filter((t) => t.id !== tokenId);
  if (data.tokens.length < initialLength) {
    await saveAuthData(data);
    return true;
  }
  return false;
}
async function revokeAllTokens() {
  const data = await loadAuthData();
  const count = data.tokens.length;
  data.tokens = [];
  await saveAuthData(data);
  return count;
}
async function listTokens() {
  const data = await loadAuthData();
  return data.tokens.filter((t) => new Date(t.expiresAt) > new Date);
}
async function addUser(email, permissions, createdBy = "admin") {
  const data = await loadAuthData();
  if (data.users.find((u) => u.email === email)) {
    throw new Error(`User ${email} already exists`);
  }
  const user = {
    email,
    permissions,
    createdAt: new Date().toISOString(),
    createdBy
  };
  data.users.push(user);
  await saveAuthData(data);
  return user;
}
async function removeUser(email) {
  const data = await loadAuthData();
  const initialLength = data.users.length;
  data.users = data.users.filter((u) => u.email !== email);
  data.tokens = data.tokens.filter((t) => t.userId !== email);
  if (data.users.length < initialLength) {
    await saveAuthData(data);
    return true;
  }
  return false;
}
async function updateUserPermissions(email, permissions) {
  const data = await loadAuthData();
  const user = data.users.find((u) => u.email === email);
  if (!user)
    return null;
  user.permissions = permissions;
  await saveAuthData(data);
  return user;
}
async function listUsers() {
  const data = await loadAuthData();
  return data.users;
}
async function getUser(email) {
  const data = await loadAuthData();
  return data.users.find((u) => u.email === email) || null;
}
function hasPermission(userPerms, required) {
  if (userPerms.includes("*"))
    return true;
  if (userPerms.includes(required))
    return true;
  const [category] = required.split(":");
  if (userPerms.includes(`${category}:*`))
    return true;
  if (required.includes(":")) {
    const [reqCat] = required.split(":");
    if (userPerms.includes(`${reqCat}:*`))
      return true;
  }
  return false;
}
async function getAdminUser() {
  const data = await loadAuthData();
  return data.admin;
}
async function isCurrentUserAdmin() {
  const data = await loadAuthData();
  const currentUser = process.env.SUDO_USER || process.env.USER || "";
  return currentUser === data.admin;
}
async function generateAdminToken(expiry = "1d") {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    throw new Error("Only the admin user can generate admin tokens");
  }
  const data = await loadAuthData();
  return generateToken(data.admin, ["*"], expiry);
}
async function createPendingApproval(userId, token) {
  const data = await loadAuthData();
  const now = Date.now();
  data.pendingApprovals = data.pendingApprovals.filter((p) => new Date(p.expiresAt).getTime() > now);
  const existing = data.pendingApprovals.find((p) => p.userId === userId && p.status === "pending");
  if (existing) {
    return existing;
  }
  const approval = {
    id: randomBytes(8).toString("hex"),
    userId,
    token,
    requestedAt: new Date().toISOString(),
    expiresAt: new Date(now + APPROVAL_TIMEOUT_MS).toISOString(),
    status: "pending"
  };
  data.pendingApprovals.push(approval);
  await saveAuthData(data);
  return approval;
}
async function listPendingApprovals() {
  const data = await loadAuthData();
  const now = Date.now();
  return data.pendingApprovals.filter((p) => p.status === "pending" && new Date(p.expiresAt).getTime() > now);
}
async function approveRequest(requestId) {
  const data = await loadAuthData();
  const approval = data.pendingApprovals.find((p) => p.id.startsWith(requestId) && p.status === "pending");
  if (!approval) {
    return { success: false, error: "Pending request not found" };
  }
  if (new Date(approval.expiresAt).getTime() < Date.now()) {
    return { success: false, error: "Request has expired" };
  }
  approval.status = "approved";
  await saveAuthData(data);
  return { success: true, userId: approval.userId };
}
async function rejectRequest(requestId) {
  const data = await loadAuthData();
  const approval = data.pendingApprovals.find((p) => p.id.startsWith(requestId) && p.status === "pending");
  if (!approval) {
    return { success: false, error: "Pending request not found" };
  }
  approval.status = "rejected";
  await saveAuthData(data);
  return { success: true, userId: approval.userId };
}
async function checkApprovalStatus(requestId) {
  const data = await loadAuthData();
  const approval = data.pendingApprovals.find((p) => p.id === requestId);
  if (!approval) {
    return { found: false };
  }
  if (new Date(approval.expiresAt).getTime() < Date.now() && approval.status === "pending") {
    return { found: true, status: "expired" };
  }
  return {
    found: true,
    status: approval.status,
    token: approval.status === "approved" ? approval.token : undefined
  };
}
async function isLoginApprovalRequired() {
  try {
    const { parse: parseYaml } = await Promise.resolve().then(() => __toESM(require_dist(), 1));
    const { readFile: readFile2 } = await import("fs/promises");
    const { existsSync: existsSync2 } = await import("fs");
    const { join: join3 } = await import("path");
    const { homedir: homedir2 } = await import("os");
    const systemYamlPath = join3(homedir2(), ".okastr8", "system.yaml");
    if (!existsSync2(systemYamlPath)) {
      return false;
    }
    const content = await readFile2(systemYamlPath, "utf-8");
    const config = parseYaml(content);
    return config?.security?.require_login_approval === true;
  } catch {
    return false;
  }
}
async function isTrustedUser(email) {
  try {
    const { parse: parseYaml } = await Promise.resolve().then(() => __toESM(require_dist(), 1));
    const { readFile: readFile2 } = await import("fs/promises");
    const { existsSync: existsSync2 } = await import("fs");
    const { join: join3 } = await import("path");
    const { homedir: homedir2 } = await import("os");
    const systemYamlPath = join3(homedir2(), ".okastr8", "system.yaml");
    if (!existsSync2(systemYamlPath)) {
      return false;
    }
    const content = await readFile2(systemYamlPath, "utf-8");
    const config = parseYaml(content);
    const trustedUsers = config?.security?.trusted_users || [];
    return trustedUsers.includes(email);
  } catch {
    return false;
  }
}
var AUTH_FILE, APPROVAL_TIMEOUT_MS;
var init_auth = __esm(() => {
  AUTH_FILE = join2(homedir(), ".okastr8", "auth.json");
  APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;
});

// node_modules/ansi-colors/symbols.js
var require_symbols = __commonJS((exports, module) => {
  var isHyper = typeof process !== "undefined" && process.env.TERM_PROGRAM === "Hyper";
  var isWindows = typeof process !== "undefined" && process.platform === "win32";
  var isLinux = typeof process !== "undefined" && process.platform === "linux";
  var common = {
    ballotDisabled: "☒",
    ballotOff: "☐",
    ballotOn: "☑",
    bullet: "•",
    bulletWhite: "◦",
    fullBlock: "█",
    heart: "❤",
    identicalTo: "≡",
    line: "─",
    mark: "※",
    middot: "·",
    minus: "－",
    multiplication: "×",
    obelus: "÷",
    pencilDownRight: "✎",
    pencilRight: "✏",
    pencilUpRight: "✐",
    percent: "%",
    pilcrow2: "❡",
    pilcrow: "¶",
    plusMinus: "±",
    question: "?",
    section: "§",
    starsOff: "☆",
    starsOn: "★",
    upDownArrow: "↕"
  };
  var windows = Object.assign({}, common, {
    check: "√",
    cross: "×",
    ellipsisLarge: "...",
    ellipsis: "...",
    info: "i",
    questionSmall: "?",
    pointer: ">",
    pointerSmall: "»",
    radioOff: "( )",
    radioOn: "(*)",
    warning: "‼"
  });
  var other = Object.assign({}, common, {
    ballotCross: "✘",
    check: "✔",
    cross: "✖",
    ellipsisLarge: "⋯",
    ellipsis: "…",
    info: "ℹ",
    questionFull: "？",
    questionSmall: "﹖",
    pointer: isLinux ? "▸" : "❯",
    pointerSmall: isLinux ? "‣" : "›",
    radioOff: "◯",
    radioOn: "◉",
    warning: "⚠"
  });
  module.exports = isWindows && !isHyper ? windows : other;
  Reflect.defineProperty(module.exports, "common", { enumerable: false, value: common });
  Reflect.defineProperty(module.exports, "windows", { enumerable: false, value: windows });
  Reflect.defineProperty(module.exports, "other", { enumerable: false, value: other });
});

// node_modules/ansi-colors/index.js
var require_ansi_colors = __commonJS((exports, module) => {
  var isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
  var ANSI_REGEX = /[\u001b\u009b][[\]#;?()]*(?:(?:(?:[^\W_]*;?[^\W_]*)\u0007)|(?:(?:[0-9]{1,4}(;[0-9]{0,4})*)?[~0-9=<>cf-nqrtyA-PRZ]))/g;
  var hasColor = () => {
    if (typeof process !== "undefined") {
      return process.env.FORCE_COLOR !== "0";
    }
    return false;
  };
  var create = () => {
    const colors = {
      enabled: hasColor(),
      visible: true,
      styles: {},
      keys: {}
    };
    const ansi = (style2) => {
      let open = style2.open = `\x1B[${style2.codes[0]}m`;
      let close = style2.close = `\x1B[${style2.codes[1]}m`;
      let regex = style2.regex = new RegExp(`\\u001b\\[${style2.codes[1]}m`, "g");
      style2.wrap = (input, newline) => {
        if (input.includes(close))
          input = input.replace(regex, close + open);
        let output = open + input + close;
        return newline ? output.replace(/\r*\n/g, `${close}$&${open}`) : output;
      };
      return style2;
    };
    const wrap = (style2, input, newline) => {
      return typeof style2 === "function" ? style2(input) : style2.wrap(input, newline);
    };
    const style = (input, stack) => {
      if (input === "" || input == null)
        return "";
      if (colors.enabled === false)
        return input;
      if (colors.visible === false)
        return "";
      let str = "" + input;
      let nl = str.includes(`
`);
      let n = stack.length;
      if (n > 0 && stack.includes("unstyle")) {
        stack = [...new Set(["unstyle", ...stack])].reverse();
      }
      while (n-- > 0)
        str = wrap(colors.styles[stack[n]], str, nl);
      return str;
    };
    const define = (name, codes, type) => {
      colors.styles[name] = ansi({ name, codes });
      let keys = colors.keys[type] || (colors.keys[type] = []);
      keys.push(name);
      Reflect.defineProperty(colors, name, {
        configurable: true,
        enumerable: true,
        set(value) {
          colors.alias(name, value);
        },
        get() {
          let color = (input) => style(input, color.stack);
          Reflect.setPrototypeOf(color, colors);
          color.stack = this.stack ? this.stack.concat(name) : [name];
          return color;
        }
      });
    };
    define("reset", [0, 0], "modifier");
    define("bold", [1, 22], "modifier");
    define("dim", [2, 22], "modifier");
    define("italic", [3, 23], "modifier");
    define("underline", [4, 24], "modifier");
    define("inverse", [7, 27], "modifier");
    define("hidden", [8, 28], "modifier");
    define("strikethrough", [9, 29], "modifier");
    define("black", [30, 39], "color");
    define("red", [31, 39], "color");
    define("green", [32, 39], "color");
    define("yellow", [33, 39], "color");
    define("blue", [34, 39], "color");
    define("magenta", [35, 39], "color");
    define("cyan", [36, 39], "color");
    define("white", [37, 39], "color");
    define("gray", [90, 39], "color");
    define("grey", [90, 39], "color");
    define("bgBlack", [40, 49], "bg");
    define("bgRed", [41, 49], "bg");
    define("bgGreen", [42, 49], "bg");
    define("bgYellow", [43, 49], "bg");
    define("bgBlue", [44, 49], "bg");
    define("bgMagenta", [45, 49], "bg");
    define("bgCyan", [46, 49], "bg");
    define("bgWhite", [47, 49], "bg");
    define("blackBright", [90, 39], "bright");
    define("redBright", [91, 39], "bright");
    define("greenBright", [92, 39], "bright");
    define("yellowBright", [93, 39], "bright");
    define("blueBright", [94, 39], "bright");
    define("magentaBright", [95, 39], "bright");
    define("cyanBright", [96, 39], "bright");
    define("whiteBright", [97, 39], "bright");
    define("bgBlackBright", [100, 49], "bgBright");
    define("bgRedBright", [101, 49], "bgBright");
    define("bgGreenBright", [102, 49], "bgBright");
    define("bgYellowBright", [103, 49], "bgBright");
    define("bgBlueBright", [104, 49], "bgBright");
    define("bgMagentaBright", [105, 49], "bgBright");
    define("bgCyanBright", [106, 49], "bgBright");
    define("bgWhiteBright", [107, 49], "bgBright");
    colors.ansiRegex = ANSI_REGEX;
    colors.hasColor = colors.hasAnsi = (str) => {
      colors.ansiRegex.lastIndex = 0;
      return typeof str === "string" && str !== "" && colors.ansiRegex.test(str);
    };
    colors.alias = (name, color) => {
      let fn = typeof color === "string" ? colors[color] : color;
      if (typeof fn !== "function") {
        throw new TypeError("Expected alias to be the name of an existing color (string) or a function");
      }
      if (!fn.stack) {
        Reflect.defineProperty(fn, "name", { value: name });
        colors.styles[name] = fn;
        fn.stack = [name];
      }
      Reflect.defineProperty(colors, name, {
        configurable: true,
        enumerable: true,
        set(value) {
          colors.alias(name, value);
        },
        get() {
          let color2 = (input) => style(input, color2.stack);
          Reflect.setPrototypeOf(color2, colors);
          color2.stack = this.stack ? this.stack.concat(fn.stack) : fn.stack;
          return color2;
        }
      });
    };
    colors.theme = (custom) => {
      if (!isObject(custom))
        throw new TypeError("Expected theme to be an object");
      for (let name of Object.keys(custom)) {
        colors.alias(name, custom[name]);
      }
      return colors;
    };
    colors.alias("unstyle", (str) => {
      if (typeof str === "string" && str !== "") {
        colors.ansiRegex.lastIndex = 0;
        return str.replace(colors.ansiRegex, "");
      }
      return "";
    });
    colors.alias("noop", (str) => str);
    colors.none = colors.clear = colors.noop;
    colors.stripColor = colors.unstyle;
    colors.symbols = require_symbols();
    colors.define = define;
    return colors;
  };
  module.exports = create();
  module.exports.create = create;
});

// node_modules/enquirer/lib/utils.js
var require_utils = __commonJS((exports) => {
  var toString = Object.prototype.toString;
  var colors = require_ansi_colors();
  var onExitCalled = false;
  var onExitCallbacks = new Set;
  var complements = {
    yellow: "blue",
    cyan: "red",
    green: "magenta",
    black: "white",
    blue: "yellow",
    red: "cyan",
    magenta: "green",
    white: "black"
  };
  exports.longest = (arr, prop) => {
    return arr.reduce((a, v) => Math.max(a, prop ? v[prop].length : v.length), 0);
  };
  exports.hasColor = (str) => !!str && colors.hasColor(str);
  var isObject = exports.isObject = (val) => {
    return val !== null && typeof val === "object" && !Array.isArray(val);
  };
  exports.nativeType = (val) => {
    return toString.call(val).slice(8, -1).toLowerCase().replace(/\s/g, "");
  };
  exports.isAsyncFn = (val) => {
    return exports.nativeType(val) === "asyncfunction";
  };
  exports.isPrimitive = (val) => {
    return val != null && typeof val !== "object" && typeof val !== "function";
  };
  exports.resolve = (context, value, ...rest) => {
    if (typeof value === "function") {
      return value.call(context, ...rest);
    }
    return value;
  };
  exports.scrollDown = (choices = []) => [...choices.slice(1), choices[0]];
  exports.scrollUp = (choices = []) => [choices.pop(), ...choices];
  exports.reorder = (arr = []) => {
    let res = arr.slice();
    res.sort((a, b) => {
      if (a.index > b.index)
        return 1;
      if (a.index < b.index)
        return -1;
      return 0;
    });
    return res;
  };
  exports.swap = (arr, index, pos) => {
    let len = arr.length;
    let idx = pos === len ? 0 : pos < 0 ? len - 1 : pos;
    let choice = arr[index];
    arr[index] = arr[idx];
    arr[idx] = choice;
  };
  exports.width = (stream, fallback = 80) => {
    let columns = stream && stream.columns ? stream.columns : fallback;
    if (stream && typeof stream.getWindowSize === "function") {
      columns = stream.getWindowSize()[0];
    }
    if (process.platform === "win32") {
      return columns - 1;
    }
    return columns;
  };
  exports.height = (stream, fallback = 20) => {
    let rows = stream && stream.rows ? stream.rows : fallback;
    if (stream && typeof stream.getWindowSize === "function") {
      rows = stream.getWindowSize()[1];
    }
    return rows;
  };
  exports.wordWrap = (str, options = {}) => {
    if (!str)
      return str;
    if (typeof options === "number") {
      options = { width: options };
    }
    let { indent = "", newline = `
` + indent, width = 80 } = options;
    let spaces = (newline + indent).match(/[^\S\n]/g) || [];
    width -= spaces.length;
    let source = `.{1,${width}}([\\s\\u200B]+|$)|[^\\s\\u200B]+?([\\s\\u200B]+|$)`;
    let output = str.trim();
    let regex = new RegExp(source, "g");
    let lines = output.match(regex) || [];
    lines = lines.map((line) => line.replace(/\n$/, ""));
    if (options.padEnd)
      lines = lines.map((line) => line.padEnd(width, " "));
    if (options.padStart)
      lines = lines.map((line) => line.padStart(width, " "));
    return indent + lines.join(newline);
  };
  exports.unmute = (color) => {
    let name = color.stack.find((n) => colors.keys.color.includes(n));
    if (name) {
      return colors[name];
    }
    let bg = color.stack.find((n) => n.slice(2) === "bg");
    if (bg) {
      return colors[name.slice(2)];
    }
    return (str) => str;
  };
  exports.pascal = (str) => str ? str[0].toUpperCase() + str.slice(1) : "";
  exports.inverse = (color) => {
    if (!color || !color.stack)
      return color;
    let name = color.stack.find((n) => colors.keys.color.includes(n));
    if (name) {
      let col = colors["bg" + exports.pascal(name)];
      return col ? col.black : color;
    }
    let bg = color.stack.find((n) => n.slice(0, 2) === "bg");
    if (bg) {
      return colors[bg.slice(2).toLowerCase()] || color;
    }
    return colors.none;
  };
  exports.complement = (color) => {
    if (!color || !color.stack)
      return color;
    let name = color.stack.find((n) => colors.keys.color.includes(n));
    let bg = color.stack.find((n) => n.slice(0, 2) === "bg");
    if (name && !bg) {
      return colors[complements[name] || name];
    }
    if (bg) {
      let lower = bg.slice(2).toLowerCase();
      let comp = complements[lower];
      if (!comp)
        return color;
      return colors["bg" + exports.pascal(comp)] || color;
    }
    return colors.none;
  };
  exports.meridiem = (date) => {
    let hours = date.getHours();
    let minutes = date.getMinutes();
    let ampm = hours >= 12 ? "pm" : "am";
    hours = hours % 12;
    let hrs = hours === 0 ? 12 : hours;
    let min = minutes < 10 ? "0" + minutes : minutes;
    return hrs + ":" + min + " " + ampm;
  };
  exports.set = (obj = {}, prop = "", val) => {
    return prop.split(".").reduce((acc, k, i, arr) => {
      let value = arr.length - 1 > i ? acc[k] || {} : val;
      if (!exports.isObject(value) && i < arr.length - 1)
        value = {};
      return acc[k] = value;
    }, obj);
  };
  exports.get = (obj = {}, prop = "", fallback) => {
    let value = obj[prop] == null ? prop.split(".").reduce((acc, k) => acc && acc[k], obj) : obj[prop];
    return value == null ? fallback : value;
  };
  exports.mixin = (target, b) => {
    if (!isObject(target))
      return b;
    if (!isObject(b))
      return target;
    for (let key of Object.keys(b)) {
      let desc = Object.getOwnPropertyDescriptor(b, key);
      if (hasOwnProperty.call(desc, "value")) {
        if (hasOwnProperty.call(target, key) && isObject(desc.value)) {
          let existing = Object.getOwnPropertyDescriptor(target, key);
          if (isObject(existing.value) && existing.value !== desc.value) {
            target[key] = exports.merge({}, target[key], b[key]);
          } else {
            Reflect.defineProperty(target, key, desc);
          }
        } else {
          Reflect.defineProperty(target, key, desc);
        }
      } else {
        Reflect.defineProperty(target, key, desc);
      }
    }
    return target;
  };
  exports.merge = (...args) => {
    let target = {};
    for (let ele of args)
      exports.mixin(target, ele);
    return target;
  };
  exports.mixinEmitter = (obj, emitter) => {
    let proto = emitter.constructor.prototype;
    for (let key of Object.keys(proto)) {
      let val = proto[key];
      if (typeof val === "function") {
        exports.define(obj, key, val.bind(emitter));
      } else {
        exports.define(obj, key, val);
      }
    }
  };
  var onExit = (quit, code) => {
    if (onExitCalled)
      return;
    onExitCalled = true;
    onExitCallbacks.forEach((fn) => fn());
    if (quit === true) {
      process.exit(128 + code);
    }
  };
  var onSigTerm = onExit.bind(null, true, 15);
  var onSigInt = onExit.bind(null, true, 2);
  exports.onExit = (callback) => {
    if (onExitCallbacks.size === 0) {
      process.once("SIGTERM", onSigTerm);
      process.once("SIGINT", onSigInt);
      process.once("exit", onExit);
    }
    onExitCallbacks.add(callback);
    return () => {
      onExitCallbacks.delete(callback);
      if (onExitCallbacks.size === 0) {
        process.off("SIGTERM", onSigTerm);
        process.off("SIGINT", onSigInt);
        process.off("exit", onExit);
      }
    };
  };
  exports.define = (obj, key, value) => {
    Reflect.defineProperty(obj, key, { value });
  };
  exports.defineExport = (obj, key, fn) => {
    let custom;
    Reflect.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      set(val) {
        custom = val;
      },
      get() {
        return custom ? custom() : fn();
      }
    });
  };
});

// node_modules/ansi-regex/index.js
var require_ansi_regex = __commonJS((exports, module) => {
  module.exports = ({ onlyFirst = false } = {}) => {
    const pattern = [
      "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
      "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))"
    ].join("|");
    return new RegExp(pattern, onlyFirst ? undefined : "g");
  };
});

// node_modules/strip-ansi/index.js
var require_strip_ansi = __commonJS((exports, module) => {
  var ansiRegex = require_ansi_regex();
  module.exports = (string) => typeof string === "string" ? string.replace(ansiRegex(), "") : string;
});

// node_modules/enquirer/lib/combos.js
var require_combos = __commonJS((exports) => {
  exports.ctrl = {
    a: "first",
    b: "backward",
    c: "cancel",
    d: "deleteForward",
    e: "last",
    f: "forward",
    g: "reset",
    i: "tab",
    k: "cutForward",
    l: "reset",
    n: "newItem",
    m: "cancel",
    j: "submit",
    p: "search",
    r: "remove",
    s: "save",
    u: "undo",
    w: "cutLeft",
    x: "toggleCursor",
    v: "paste"
  };
  exports.shift = {
    up: "shiftUp",
    down: "shiftDown",
    left: "shiftLeft",
    right: "shiftRight",
    tab: "prev"
  };
  exports.fn = {
    up: "pageUp",
    down: "pageDown",
    left: "pageLeft",
    right: "pageRight",
    delete: "deleteForward"
  };
  exports.option = {
    b: "backward",
    f: "forward",
    d: "cutRight",
    left: "cutLeft",
    up: "altUp",
    down: "altDown"
  };
  exports.keys = {
    pageup: "pageUp",
    pagedown: "pageDown",
    home: "home",
    end: "end",
    cancel: "cancel",
    delete: "deleteForward",
    backspace: "delete",
    down: "down",
    enter: "submit",
    escape: "cancel",
    left: "left",
    space: "space",
    number: "number",
    return: "submit",
    right: "right",
    tab: "next",
    up: "up"
  };
});

// node_modules/enquirer/lib/queue.js
var require_queue = __commonJS((exports, module) => {
  module.exports = class Queue {
    _queue = [];
    _executing = false;
    _jobRunner = null;
    constructor(jobRunner) {
      this._jobRunner = jobRunner;
    }
    enqueue = (...args) => {
      this._queue.push(args);
      this._dequeue();
    };
    destroy() {
      this._queue.length = 0;
      this._jobRunner = null;
    }
    _dequeue() {
      if (this._executing || !this._queue.length)
        return;
      this._executing = true;
      this._jobRunner(...this._queue.shift());
      setTimeout(() => {
        this._executing = false;
        this._dequeue();
      });
    }
  };
});

// node_modules/enquirer/lib/keypress.js
var require_keypress = __commonJS((exports, module) => {
  var readline = __require("readline");
  var combos = require_combos();
  var Queue = require_queue();
  var metaKeyCodeRe = /^(?:\x1b)([a-zA-Z0-9])$/;
  var fnKeyRe = /^(?:\x1b+)(O|N|\[|\[\[)(?:(\d+)(?:;(\d+))?([~^$])|(?:1;)?(\d+)?([a-zA-Z]))/;
  var keyName = {
    OP: "f1",
    OQ: "f2",
    OR: "f3",
    OS: "f4",
    "[11~": "f1",
    "[12~": "f2",
    "[13~": "f3",
    "[14~": "f4",
    "[[A": "f1",
    "[[B": "f2",
    "[[C": "f3",
    "[[D": "f4",
    "[[E": "f5",
    "[15~": "f5",
    "[17~": "f6",
    "[18~": "f7",
    "[19~": "f8",
    "[20~": "f9",
    "[21~": "f10",
    "[23~": "f11",
    "[24~": "f12",
    "[A": "up",
    "[B": "down",
    "[C": "right",
    "[D": "left",
    "[E": "clear",
    "[F": "end",
    "[H": "home",
    OA: "up",
    OB: "down",
    OC: "right",
    OD: "left",
    OE: "clear",
    OF: "end",
    OH: "home",
    "[1~": "home",
    "[2~": "insert",
    "[3~": "delete",
    "[4~": "end",
    "[5~": "pageup",
    "[6~": "pagedown",
    "[[5~": "pageup",
    "[[6~": "pagedown",
    "[7~": "home",
    "[8~": "end",
    "[a": "up",
    "[b": "down",
    "[c": "right",
    "[d": "left",
    "[e": "clear",
    "[2$": "insert",
    "[3$": "delete",
    "[5$": "pageup",
    "[6$": "pagedown",
    "[7$": "home",
    "[8$": "end",
    Oa: "up",
    Ob: "down",
    Oc: "right",
    Od: "left",
    Oe: "clear",
    "[2^": "insert",
    "[3^": "delete",
    "[5^": "pageup",
    "[6^": "pagedown",
    "[7^": "home",
    "[8^": "end",
    "[Z": "tab"
  };
  function isShiftKey(code) {
    return ["[a", "[b", "[c", "[d", "[e", "[2$", "[3$", "[5$", "[6$", "[7$", "[8$", "[Z"].includes(code);
  }
  function isCtrlKey(code) {
    return ["Oa", "Ob", "Oc", "Od", "Oe", "[2^", "[3^", "[5^", "[6^", "[7^", "[8^"].includes(code);
  }
  var keypress = (s = "", event = {}) => {
    let parts;
    let key = {
      name: event.name,
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
      sequence: s,
      raw: s,
      ...event
    };
    if (Buffer.isBuffer(s)) {
      if (s[0] > 127 && s[1] === undefined) {
        s[0] -= 128;
        s = "\x1B" + String(s);
      } else {
        s = String(s);
      }
    } else if (s !== undefined && typeof s !== "string") {
      s = String(s);
    } else if (!s) {
      s = key.sequence || "";
    }
    key.sequence = key.sequence || s || key.name;
    if (s === "\r") {
      key.raw = undefined;
      key.name = "return";
    } else if (s === `
`) {
      key.name = "enter";
    } else if (s === "\t") {
      key.name = "tab";
    } else if (s === "\b" || s === "" || s === "\x1B" || s === "\x1B\b") {
      key.name = "backspace";
      key.meta = s.charAt(0) === "\x1B";
    } else if (s === "\x1B" || s === "\x1B\x1B") {
      key.name = "escape";
      key.meta = s.length === 2;
    } else if (s === " " || s === "\x1B ") {
      key.name = "space";
      key.meta = s.length === 2;
    } else if (s <= "\x1A") {
      key.name = String.fromCharCode(s.charCodeAt(0) + 97 - 1);
      key.ctrl = true;
    } else if (s.length === 1 && s >= "0" && s <= "9") {
      key.name = "number";
    } else if (s.length === 1 && s >= "a" && s <= "z") {
      key.name = s;
    } else if (s.length === 1 && s >= "A" && s <= "Z") {
      key.name = s.toLowerCase();
      key.shift = true;
    } else if (parts = metaKeyCodeRe.exec(s)) {
      key.meta = true;
      key.shift = /^[A-Z]$/.test(parts[1]);
    } else if (parts = fnKeyRe.exec(s)) {
      let segs = [...s];
      if (segs[0] === "\x1B" && segs[1] === "\x1B") {
        key.option = true;
      }
      let code = [parts[1], parts[2], parts[4], parts[6]].filter(Boolean).join("");
      let modifier = (parts[3] || parts[5] || 1) - 1;
      key.ctrl = !!(modifier & 4);
      key.meta = !!(modifier & 10);
      key.shift = !!(modifier & 1);
      key.code = code;
      key.name = keyName[code];
      key.shift = isShiftKey(code) || key.shift;
      key.ctrl = isCtrlKey(code) || key.ctrl;
    }
    return key;
  };
  keypress.listen = (options = {}, onKeypress) => {
    let { stdin } = options;
    if (!stdin || stdin !== process.stdin && !stdin.isTTY) {
      throw new Error("Invalid stream passed");
    }
    let rl = readline.createInterface({ terminal: true, input: stdin });
    readline.emitKeypressEvents(stdin, rl);
    const queue = new Queue((buf, key) => onKeypress(buf, keypress(buf, key), rl));
    let isRaw = stdin.isRaw;
    if (stdin.isTTY)
      stdin.setRawMode(true);
    stdin.on("keypress", queue.enqueue);
    rl.resume();
    let off = () => {
      if (stdin.isTTY)
        stdin.setRawMode(isRaw);
      stdin.removeListener("keypress", queue.enqueue);
      queue.destroy();
      rl.pause();
      rl.close();
    };
    return off;
  };
  keypress.action = (buf, key, customActions) => {
    let obj = { ...combos, ...customActions };
    if (key.ctrl) {
      key.action = obj.ctrl[key.name];
      return key;
    }
    if (key.option && obj.option) {
      key.action = obj.option[key.name];
      return key;
    }
    if (key.shift) {
      key.action = obj.shift[key.name];
      return key;
    }
    key.action = obj.keys[key.name];
    return key;
  };
  module.exports = keypress;
});

// node_modules/enquirer/lib/timer.js
var require_timer = __commonJS((exports, module) => {
  module.exports = (prompt) => {
    prompt.timers = prompt.timers || {};
    let timers = prompt.options.timers;
    if (!timers)
      return;
    for (let key of Object.keys(timers)) {
      let opts = timers[key];
      if (typeof opts === "number") {
        opts = { interval: opts };
      }
      create(prompt, key, opts);
    }
  };
  function create(prompt, name, options = {}) {
    let timer = prompt.timers[name] = { name, start: Date.now(), ms: 0, tick: 0 };
    let ms = options.interval || 120;
    timer.frames = options.frames || [];
    timer.loading = true;
    let interval = setInterval(() => {
      timer.ms = Date.now() - timer.start;
      timer.tick++;
      prompt.render();
    }, ms);
    timer.stop = () => {
      timer.loading = false;
      clearInterval(interval);
    };
    Reflect.defineProperty(timer, "interval", { value: interval });
    prompt.once("close", () => timer.stop());
    return timer.stop;
  }
});

// node_modules/enquirer/lib/state.js
var require_state = __commonJS((exports, module) => {
  var { define, width } = require_utils();

  class State {
    constructor(prompt) {
      let options = prompt.options;
      define(this, "_prompt", prompt);
      this.type = prompt.type;
      this.name = prompt.name;
      this.message = "";
      this.header = "";
      this.footer = "";
      this.error = "";
      this.hint = "";
      this.input = "";
      this.cursor = 0;
      this.index = 0;
      this.lines = 0;
      this.tick = 0;
      this.prompt = "";
      this.buffer = "";
      this.width = width(options.stdout || process.stdout);
      Object.assign(this, options);
      this.name = this.name || this.message;
      this.message = this.message || this.name;
      this.symbols = prompt.symbols;
      this.styles = prompt.styles;
      this.required = new Set;
      this.cancelled = false;
      this.submitted = false;
    }
    clone() {
      let state = { ...this };
      state.status = this.status;
      state.buffer = Buffer.from(state.buffer);
      delete state.clone;
      return state;
    }
    set color(val) {
      this._color = val;
    }
    get color() {
      let styles = this.prompt.styles;
      if (this.cancelled)
        return styles.cancelled;
      if (this.submitted)
        return styles.submitted;
      let color = this._color || styles[this.status];
      return typeof color === "function" ? color : styles.pending;
    }
    set loading(value) {
      this._loading = value;
    }
    get loading() {
      if (typeof this._loading === "boolean")
        return this._loading;
      if (this.loadingChoices)
        return "choices";
      return false;
    }
    get status() {
      if (this.cancelled)
        return "cancelled";
      if (this.submitted)
        return "submitted";
      return "pending";
    }
  }
  module.exports = State;
});

// node_modules/enquirer/lib/styles.js
var require_styles = __commonJS((exports, module) => {
  var utils = require_utils();
  var colors = require_ansi_colors();
  var styles = {
    default: colors.noop,
    noop: colors.noop,
    set inverse(custom) {
      this._inverse = custom;
    },
    get inverse() {
      return this._inverse || utils.inverse(this.primary);
    },
    set complement(custom) {
      this._complement = custom;
    },
    get complement() {
      return this._complement || utils.complement(this.primary);
    },
    primary: colors.cyan,
    success: colors.green,
    danger: colors.magenta,
    strong: colors.bold,
    warning: colors.yellow,
    muted: colors.dim,
    disabled: colors.gray,
    dark: colors.dim.gray,
    underline: colors.underline,
    set info(custom) {
      this._info = custom;
    },
    get info() {
      return this._info || this.primary;
    },
    set em(custom) {
      this._em = custom;
    },
    get em() {
      return this._em || this.primary.underline;
    },
    set heading(custom) {
      this._heading = custom;
    },
    get heading() {
      return this._heading || this.muted.underline;
    },
    set pending(custom) {
      this._pending = custom;
    },
    get pending() {
      return this._pending || this.primary;
    },
    set submitted(custom) {
      this._submitted = custom;
    },
    get submitted() {
      return this._submitted || this.success;
    },
    set cancelled(custom) {
      this._cancelled = custom;
    },
    get cancelled() {
      return this._cancelled || this.danger;
    },
    set typing(custom) {
      this._typing = custom;
    },
    get typing() {
      return this._typing || this.dim;
    },
    set placeholder(custom) {
      this._placeholder = custom;
    },
    get placeholder() {
      return this._placeholder || this.primary.dim;
    },
    set highlight(custom) {
      this._highlight = custom;
    },
    get highlight() {
      return this._highlight || this.inverse;
    }
  };
  styles.merge = (options = {}) => {
    if (options.styles && typeof options.styles.enabled === "boolean") {
      colors.enabled = options.styles.enabled;
    }
    if (options.styles && typeof options.styles.visible === "boolean") {
      colors.visible = options.styles.visible;
    }
    let result = utils.merge({}, styles, options.styles);
    delete result.merge;
    for (let key of Object.keys(colors)) {
      if (!hasOwnProperty.call(result, key)) {
        Reflect.defineProperty(result, key, { get: () => colors[key] });
      }
    }
    for (let key of Object.keys(colors.styles)) {
      if (!hasOwnProperty.call(result, key)) {
        Reflect.defineProperty(result, key, { get: () => colors[key] });
      }
    }
    return result;
  };
  module.exports = styles;
});

// node_modules/enquirer/lib/symbols.js
var require_symbols2 = __commonJS((exports, module) => {
  var isWindows = process.platform === "win32";
  var colors = require_ansi_colors();
  var utils = require_utils();
  var symbols = {
    ...colors.symbols,
    upDownDoubleArrow: "⇕",
    upDownDoubleArrow2: "⬍",
    upDownArrow: "↕",
    asterisk: "*",
    asterism: "⁂",
    bulletWhite: "◦",
    electricArrow: "⌁",
    ellipsisLarge: "⋯",
    ellipsisSmall: "…",
    fullBlock: "█",
    identicalTo: "≡",
    indicator: colors.symbols.check,
    leftAngle: "‹",
    mark: "※",
    minus: "−",
    multiplication: "×",
    obelus: "÷",
    percent: "%",
    pilcrow: "¶",
    pilcrow2: "❡",
    pencilUpRight: "✐",
    pencilDownRight: "✎",
    pencilRight: "✏",
    plus: "+",
    plusMinus: "±",
    pointRight: "☞",
    rightAngle: "›",
    section: "§",
    hexagon: { off: "⬡", on: "⬢", disabled: "⬢" },
    ballot: { on: "☑", off: "☐", disabled: "☒" },
    stars: { on: "★", off: "☆", disabled: "☆" },
    folder: { on: "▼", off: "▶", disabled: "▶" },
    prefix: {
      pending: colors.symbols.question,
      submitted: colors.symbols.check,
      cancelled: colors.symbols.cross
    },
    separator: {
      pending: colors.symbols.pointerSmall,
      submitted: colors.symbols.middot,
      cancelled: colors.symbols.middot
    },
    radio: {
      off: isWindows ? "( )" : "◯",
      on: isWindows ? "(*)" : "◉",
      disabled: isWindows ? "(|)" : "Ⓘ"
    },
    numbers: ["⓪", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫", "⑬", "⑭", "⑮", "⑯", "⑰", "⑱", "⑲", "⑳", "㉑", "㉒", "㉓", "㉔", "㉕", "㉖", "㉗", "㉘", "㉙", "㉚", "㉛", "㉜", "㉝", "㉞", "㉟", "㊱", "㊲", "㊳", "㊴", "㊵", "㊶", "㊷", "㊸", "㊹", "㊺", "㊻", "㊼", "㊽", "㊾", "㊿"]
  };
  symbols.merge = (options) => {
    let result = utils.merge({}, colors.symbols, symbols, options.symbols);
    delete result.merge;
    return result;
  };
  module.exports = symbols;
});

// node_modules/enquirer/lib/theme.js
var require_theme = __commonJS((exports, module) => {
  var styles = require_styles();
  var symbols = require_symbols2();
  var utils = require_utils();
  module.exports = (prompt) => {
    prompt.options = utils.merge({}, prompt.options.theme, prompt.options);
    prompt.symbols = symbols.merge(prompt.options);
    prompt.styles = styles.merge(prompt.options);
  };
});

// node_modules/enquirer/lib/ansi.js
var require_ansi = __commonJS((exports, module) => {
  var isTerm = process.env.TERM_PROGRAM === "Apple_Terminal";
  var stripAnsi = require_strip_ansi();
  var utils = require_utils();
  var ansi = module.exports = exports;
  var ESC = "\x1B[";
  var BEL = "\x07";
  var hidden = false;
  var code = ansi.code = {
    bell: BEL,
    beep: BEL,
    beginning: `${ESC}G`,
    down: `${ESC}J`,
    esc: ESC,
    getPosition: `${ESC}6n`,
    hide: `${ESC}?25l`,
    line: `${ESC}2K`,
    lineEnd: `${ESC}K`,
    lineStart: `${ESC}1K`,
    restorePosition: ESC + (isTerm ? "8" : "u"),
    savePosition: ESC + (isTerm ? "7" : "s"),
    screen: `${ESC}2J`,
    show: `${ESC}?25h`,
    up: `${ESC}1J`
  };
  var cursor = ansi.cursor = {
    get hidden() {
      return hidden;
    },
    hide() {
      hidden = true;
      return code.hide;
    },
    show() {
      hidden = false;
      return code.show;
    },
    forward: (count = 1) => `${ESC}${count}C`,
    backward: (count = 1) => `${ESC}${count}D`,
    nextLine: (count = 1) => `${ESC}E`.repeat(count),
    prevLine: (count = 1) => `${ESC}F`.repeat(count),
    up: (count = 1) => count ? `${ESC}${count}A` : "",
    down: (count = 1) => count ? `${ESC}${count}B` : "",
    right: (count = 1) => count ? `${ESC}${count}C` : "",
    left: (count = 1) => count ? `${ESC}${count}D` : "",
    to(x, y) {
      return y ? `${ESC}${y + 1};${x + 1}H` : `${ESC}${x + 1}G`;
    },
    move(x = 0, y = 0) {
      let res = "";
      res += x < 0 ? cursor.left(-x) : x > 0 ? cursor.right(x) : "";
      res += y < 0 ? cursor.up(-y) : y > 0 ? cursor.down(y) : "";
      return res;
    },
    strLen(str) {
      var realLength = 0, len = str.length, charCode = -1;
      for (var i = 0;i < len; i++) {
        charCode = str.charCodeAt(i);
        if (charCode >= 0 && charCode <= 128)
          realLength += 1;
        else
          realLength += 2;
      }
      return realLength;
    },
    restore(state = {}) {
      let { after, cursor: cursor2, initial, input, prompt, size, value } = state;
      initial = utils.isPrimitive(initial) ? String(initial) : "";
      input = utils.isPrimitive(input) ? String(input) : "";
      value = utils.isPrimitive(value) ? String(value) : "";
      if (size) {
        let codes = ansi.cursor.up(size) + ansi.cursor.to(this.strLen(prompt));
        let diff = input.length - cursor2;
        if (diff > 0) {
          codes += ansi.cursor.left(diff);
        }
        return codes;
      }
      if (value || after) {
        let pos = !input && !!initial ? -this.strLen(initial) : -this.strLen(input) + cursor2;
        if (after)
          pos -= this.strLen(after);
        if (input === "" && initial && !prompt.includes(initial)) {
          pos += this.strLen(initial);
        }
        return ansi.cursor.move(pos);
      }
    }
  };
  var erase = ansi.erase = {
    screen: code.screen,
    up: code.up,
    down: code.down,
    line: code.line,
    lineEnd: code.lineEnd,
    lineStart: code.lineStart,
    lines(n) {
      let str = "";
      for (let i = 0;i < n; i++) {
        str += ansi.erase.line + (i < n - 1 ? ansi.cursor.up(1) : "");
      }
      if (n)
        str += ansi.code.beginning;
      return str;
    }
  };
  ansi.clear = (input = "", columns = process.stdout.columns) => {
    if (!columns)
      return erase.line + cursor.to(0);
    let width = (str) => [...stripAnsi(str)].length;
    let lines = input.split(/\r?\n/);
    let rows = 0;
    for (let line of lines) {
      rows += 1 + Math.floor(Math.max(width(line) - 1, 0) / columns);
    }
    return (erase.line + cursor.prevLine()).repeat(rows - 1) + erase.line + cursor.to(0);
  };
});

// node_modules/enquirer/lib/prompt.js
var require_prompt = __commonJS((exports, module) => {
  var Events = __require("events");
  var stripAnsi = require_strip_ansi();
  var keypress = require_keypress();
  var timer = require_timer();
  var State = require_state();
  var theme = require_theme();
  var utils = require_utils();
  var ansi = require_ansi();

  class Prompt extends Events {
    constructor(options = {}) {
      super();
      this.name = options.name;
      this.type = options.type;
      this.options = options;
      theme(this);
      timer(this);
      this.state = new State(this);
      this.initial = [options.initial, options.default].find((v) => v != null);
      this.stdout = options.stdout || process.stdout;
      this.stdin = options.stdin || process.stdin;
      this.scale = options.scale || 1;
      this.term = this.options.term || process.env.TERM_PROGRAM;
      this.margin = margin(this.options.margin);
      this.setMaxListeners(0);
      setOptions(this);
    }
    async keypress(input, event = {}) {
      this.keypressed = true;
      let key = keypress.action(input, keypress(input, event), this.options.actions);
      this.state.keypress = key;
      this.emit("keypress", input, key);
      this.emit("state", this.state.clone());
      const fn = this.options[key.action] || this[key.action] || this.dispatch;
      if (typeof fn === "function") {
        return await fn.call(this, input, key);
      }
      this.alert();
    }
    alert() {
      delete this.state.alert;
      if (this.options.show === false) {
        this.emit("alert");
      } else {
        this.stdout.write(ansi.code.beep);
      }
    }
    cursorHide() {
      this.stdout.write(ansi.cursor.hide());
      const releaseOnExit = utils.onExit(() => this.cursorShow());
      this.on("close", () => {
        this.cursorShow();
        releaseOnExit();
      });
    }
    cursorShow() {
      this.stdout.write(ansi.cursor.show());
    }
    write(str) {
      if (!str)
        return;
      if (this.stdout && this.state.show !== false) {
        this.stdout.write(str);
      }
      this.state.buffer += str;
    }
    clear(lines = 0) {
      let buffer = this.state.buffer;
      this.state.buffer = "";
      if (!buffer && !lines || this.options.show === false)
        return;
      this.stdout.write(ansi.cursor.down(lines) + ansi.clear(buffer, this.width));
    }
    restore() {
      if (this.state.closed || this.options.show === false)
        return;
      let { prompt, after, rest } = this.sections();
      let { cursor, initial = "", input = "", value = "" } = this;
      let size = this.state.size = rest.length;
      let state = { after, cursor, initial, input, prompt, size, value };
      let codes = ansi.cursor.restore(state);
      if (codes) {
        this.stdout.write(codes);
      }
    }
    sections() {
      let { buffer, input, prompt } = this.state;
      prompt = stripAnsi(prompt);
      let buf = stripAnsi(buffer);
      let idx = buf.indexOf(prompt);
      let header = buf.slice(0, idx);
      let rest = buf.slice(idx);
      let lines = rest.split(`
`);
      let first = lines[0];
      let last = lines[lines.length - 1];
      let promptLine = prompt + (input ? " " + input : "");
      let len = promptLine.length;
      let after = len < first.length ? first.slice(len + 1) : "";
      return { header, prompt: first, after, rest: lines.slice(1), last };
    }
    async submit() {
      this.state.submitted = true;
      this.state.validating = true;
      if (this.options.onSubmit) {
        await this.options.onSubmit.call(this, this.name, this.value, this);
      }
      let result = this.state.error || await this.validate(this.value, this.state);
      if (result !== true) {
        let error = `
` + this.symbols.pointer + " ";
        if (typeof result === "string") {
          error += result.trim();
        } else {
          error += "Invalid input";
        }
        this.state.error = `
` + this.styles.danger(error);
        this.state.submitted = false;
        await this.render();
        await this.alert();
        this.state.validating = false;
        this.state.error = undefined;
        return;
      }
      this.state.validating = false;
      await this.render();
      await this.close();
      this.value = await this.result(this.value);
      this.emit("submit", this.value);
    }
    async cancel(err) {
      this.state.cancelled = this.state.submitted = true;
      await this.render();
      await this.close();
      if (typeof this.options.onCancel === "function") {
        await this.options.onCancel.call(this, this.name, this.value, this);
      }
      this.emit("cancel", await this.error(err));
    }
    async close() {
      this.state.closed = true;
      try {
        let sections = this.sections();
        let lines = Math.ceil(sections.prompt.length / this.width);
        if (sections.rest) {
          this.write(ansi.cursor.down(sections.rest.length));
        }
        this.write(`
`.repeat(lines));
      } catch (err) {}
      this.emit("close");
    }
    start() {
      if (!this.stop && this.options.show !== false) {
        this.stop = keypress.listen(this, this.keypress.bind(this));
        this.once("close", this.stop);
        this.emit("start", this);
      }
    }
    async skip() {
      this.skipped = this.options.skip === true;
      if (typeof this.options.skip === "function") {
        this.skipped = await this.options.skip.call(this, this.name, this.value);
      }
      return this.skipped;
    }
    async initialize() {
      let { format, options, result } = this;
      this.format = () => format.call(this, this.value);
      this.result = () => result.call(this, this.value);
      if (typeof options.initial === "function") {
        this.initial = await options.initial.call(this, this);
      }
      if (typeof options.onRun === "function") {
        await options.onRun.call(this, this);
      }
      if (typeof options.onSubmit === "function") {
        let onSubmit = options.onSubmit.bind(this);
        let submit = this.submit.bind(this);
        delete this.options.onSubmit;
        this.submit = async () => {
          await onSubmit(this.name, this.value, this);
          return submit();
        };
      }
      await this.start();
      await this.render();
    }
    render() {
      throw new Error("expected prompt to have a custom render method");
    }
    run() {
      return new Promise(async (resolve, reject) => {
        this.once("submit", resolve);
        this.once("cancel", reject);
        if (await this.skip()) {
          this.render = () => {};
          return this.submit();
        }
        await this.initialize();
        this.emit("run");
      });
    }
    async element(name, choice, i) {
      let { options, state, symbols, timers } = this;
      let timer2 = timers && timers[name];
      state.timer = timer2;
      let value = options[name] || state[name] || symbols[name];
      let val = choice && choice[name] != null ? choice[name] : await value;
      if (val === "")
        return val;
      let res = await this.resolve(val, state, choice, i);
      if (!res && choice && choice[name]) {
        return this.resolve(value, state, choice, i);
      }
      return res;
    }
    async prefix() {
      let element = await this.element("prefix") || this.symbols;
      let timer2 = this.timers && this.timers.prefix;
      let state = this.state;
      state.timer = timer2;
      if (utils.isObject(element))
        element = element[state.status] || element.pending;
      if (!utils.hasColor(element)) {
        let style = this.styles[state.status] || this.styles.pending;
        return style(element);
      }
      return element;
    }
    async message() {
      let message = await this.element("message");
      if (!utils.hasColor(message)) {
        return this.styles.strong(message);
      }
      return message;
    }
    async separator() {
      let element = await this.element("separator") || this.symbols;
      let timer2 = this.timers && this.timers.separator;
      let state = this.state;
      state.timer = timer2;
      let value = element[state.status] || element.pending || state.separator;
      let ele = await this.resolve(value, state);
      if (utils.isObject(ele))
        ele = ele[state.status] || ele.pending;
      if (!utils.hasColor(ele)) {
        return this.styles.muted(ele);
      }
      return ele;
    }
    async pointer(choice, i) {
      let val = await this.element("pointer", choice, i);
      if (typeof val === "string" && utils.hasColor(val)) {
        return val;
      }
      if (val) {
        let styles = this.styles;
        let focused = this.index === i;
        let style = focused ? styles.primary : (val2) => val2;
        let ele = await this.resolve(val[focused ? "on" : "off"] || val, this.state);
        let styled = !utils.hasColor(ele) ? style(ele) : ele;
        return focused ? styled : " ".repeat(ele.length);
      }
    }
    async indicator(choice, i) {
      let val = await this.element("indicator", choice, i);
      if (typeof val === "string" && utils.hasColor(val)) {
        return val;
      }
      if (val) {
        let styles = this.styles;
        let enabled = choice.enabled === true;
        let style = enabled ? styles.success : styles.dark;
        let ele = val[enabled ? "on" : "off"] || val;
        return !utils.hasColor(ele) ? style(ele) : ele;
      }
      return "";
    }
    body() {
      return null;
    }
    footer() {
      if (this.state.status === "pending") {
        return this.element("footer");
      }
    }
    header() {
      if (this.state.status === "pending") {
        return this.element("header");
      }
    }
    async hint() {
      if (this.state.status === "pending" && !this.isValue(this.state.input)) {
        let hint = await this.element("hint");
        if (!utils.hasColor(hint)) {
          return this.styles.muted(hint);
        }
        return hint;
      }
    }
    error(err) {
      return !this.state.submitted ? err || this.state.error : "";
    }
    format(value) {
      return value;
    }
    result(value) {
      return value;
    }
    validate(value) {
      if (this.options.required === true) {
        return this.isValue(value);
      }
      return true;
    }
    isValue(value) {
      return value != null && value !== "";
    }
    resolve(value, ...args) {
      return utils.resolve(this, value, ...args);
    }
    get base() {
      return Prompt.prototype;
    }
    get style() {
      return this.styles[this.state.status];
    }
    get height() {
      return this.options.rows || utils.height(this.stdout, 25);
    }
    get width() {
      return this.options.columns || utils.width(this.stdout, 80);
    }
    get size() {
      return { width: this.width, height: this.height };
    }
    set cursor(value) {
      this.state.cursor = value;
    }
    get cursor() {
      return this.state.cursor;
    }
    set input(value) {
      this.state.input = value;
    }
    get input() {
      return this.state.input;
    }
    set value(value) {
      this.state.value = value;
    }
    get value() {
      let { input, value } = this.state;
      let result = [value, input].find(this.isValue.bind(this));
      return this.isValue(result) ? result : this.initial;
    }
    static get prompt() {
      return (options) => new this(options).run();
    }
  }
  function setOptions(prompt) {
    let isValidKey = (key) => {
      return prompt[key] === undefined || typeof prompt[key] === "function";
    };
    let ignore = [
      "actions",
      "choices",
      "initial",
      "margin",
      "roles",
      "styles",
      "symbols",
      "theme",
      "timers",
      "value"
    ];
    let ignoreFn = [
      "body",
      "footer",
      "error",
      "header",
      "hint",
      "indicator",
      "message",
      "prefix",
      "separator",
      "skip"
    ];
    for (let key of Object.keys(prompt.options)) {
      if (ignore.includes(key))
        continue;
      if (/^on[A-Z]/.test(key))
        continue;
      let option = prompt.options[key];
      if (typeof option === "function" && isValidKey(key)) {
        if (!ignoreFn.includes(key)) {
          prompt[key] = option.bind(prompt);
        }
      } else if (typeof prompt[key] !== "function") {
        prompt[key] = option;
      }
    }
  }
  function margin(value) {
    if (typeof value === "number") {
      value = [value, value, value, value];
    }
    let arr = [].concat(value || []);
    let pad = (i) => i % 2 === 0 ? `
` : " ";
    let res = [];
    for (let i = 0;i < 4; i++) {
      let char = pad(i);
      if (arr[i]) {
        res.push(char.repeat(arr[i]));
      } else {
        res.push("");
      }
    }
    return res;
  }
  module.exports = Prompt;
});

// node_modules/enquirer/lib/roles.js
var require_roles = __commonJS((exports, module) => {
  var utils = require_utils();
  var roles = {
    default(prompt, choice) {
      return choice;
    },
    checkbox(prompt, choice) {
      throw new Error("checkbox role is not implemented yet");
    },
    editable(prompt, choice) {
      throw new Error("editable role is not implemented yet");
    },
    expandable(prompt, choice) {
      throw new Error("expandable role is not implemented yet");
    },
    heading(prompt, choice) {
      choice.disabled = "";
      choice.indicator = [choice.indicator, " "].find((v) => v != null);
      choice.message = choice.message || "";
      return choice;
    },
    input(prompt, choice) {
      throw new Error("input role is not implemented yet");
    },
    option(prompt, choice) {
      return roles.default(prompt, choice);
    },
    radio(prompt, choice) {
      throw new Error("radio role is not implemented yet");
    },
    separator(prompt, choice) {
      choice.disabled = "";
      choice.indicator = [choice.indicator, " "].find((v) => v != null);
      choice.message = choice.message || prompt.symbols.line.repeat(5);
      return choice;
    },
    spacer(prompt, choice) {
      return choice;
    }
  };
  module.exports = (name, options = {}) => {
    let role = utils.merge({}, roles, options.roles);
    return role[name] || role.default;
  };
});

// node_modules/enquirer/lib/types/array.js
var require_array = __commonJS((exports, module) => {
  var stripAnsi = require_strip_ansi();
  var Prompt = require_prompt();
  var roles = require_roles();
  var utils = require_utils();
  var { reorder, scrollUp, scrollDown, isObject, swap } = utils;

  class ArrayPrompt extends Prompt {
    constructor(options) {
      super(options);
      this.cursorHide();
      this.maxSelected = options.maxSelected || Infinity;
      this.multiple = options.multiple || false;
      this.initial = options.initial || 0;
      this.delay = options.delay || 0;
      this.longest = 0;
      this.num = "";
    }
    async initialize() {
      if (typeof this.options.initial === "function") {
        this.initial = await this.options.initial.call(this);
      }
      await this.reset(true);
      await super.initialize();
    }
    async reset() {
      let { choices, initial, autofocus, suggest } = this.options;
      this.state._choices = [];
      this.state.choices = [];
      this.choices = await Promise.all(await this.toChoices(choices));
      this.choices.forEach((ch) => ch.enabled = false);
      if (typeof suggest !== "function" && this.selectable.length === 0) {
        throw new Error("At least one choice must be selectable");
      }
      if (isObject(initial))
        initial = Object.keys(initial);
      if (Array.isArray(initial)) {
        if (autofocus != null)
          this.index = this.findIndex(autofocus);
        initial.forEach((v) => this.enable(this.find(v)));
        await this.render();
      } else {
        if (autofocus != null)
          initial = autofocus;
        if (typeof initial === "string")
          initial = this.findIndex(initial);
        if (typeof initial === "number" && initial > -1) {
          this.index = Math.max(0, Math.min(initial, this.choices.length));
          this.enable(this.find(this.index));
        }
      }
      if (this.isDisabled(this.focused)) {
        await this.down();
      }
    }
    async toChoices(value, parent) {
      this.state.loadingChoices = true;
      let choices = [];
      let index = 0;
      let toChoices = async (items, parent2) => {
        if (typeof items === "function")
          items = await items.call(this);
        if (items instanceof Promise)
          items = await items;
        for (let i = 0;i < items.length; i++) {
          let choice = items[i] = await this.toChoice(items[i], index++, parent2);
          choices.push(choice);
          if (choice.choices) {
            await toChoices(choice.choices, choice);
          }
        }
        return choices;
      };
      return toChoices(value, parent).then((choices2) => {
        this.state.loadingChoices = false;
        return choices2;
      });
    }
    async toChoice(ele, i, parent) {
      if (typeof ele === "function")
        ele = await ele.call(this, this);
      if (ele instanceof Promise)
        ele = await ele;
      if (typeof ele === "string")
        ele = { name: ele };
      if (ele.normalized)
        return ele;
      ele.normalized = true;
      let origVal = ele.value;
      let role = roles(ele.role, this.options);
      ele = role(this, ele);
      if (typeof ele.disabled === "string" && !ele.hint) {
        ele.hint = ele.disabled;
        ele.disabled = true;
      }
      if (ele.disabled === true && ele.hint == null) {
        ele.hint = "(disabled)";
      }
      if (ele.index != null)
        return ele;
      ele.name = ele.name || ele.key || ele.title || ele.value || ele.message;
      ele.message = ele.message || ele.name || "";
      ele.value = [ele.value, ele.name].find(this.isValue.bind(this));
      ele.input = "";
      ele.index = i;
      ele.cursor = 0;
      utils.define(ele, "parent", parent);
      ele.level = parent ? parent.level + 1 : 1;
      if (ele.indent == null) {
        ele.indent = parent ? parent.indent + "  " : ele.indent || "";
      }
      ele.path = parent ? parent.path + "." + ele.name : ele.name;
      ele.enabled = !!(this.multiple && !this.isDisabled(ele) && (ele.enabled || this.isSelected(ele)));
      if (!this.isDisabled(ele)) {
        this.longest = Math.max(this.longest, stripAnsi(ele.message).length);
      }
      let choice = { ...ele };
      ele.reset = (input = choice.input, value = choice.value) => {
        for (let key of Object.keys(choice))
          ele[key] = choice[key];
        ele.input = input;
        ele.value = value;
      };
      if (origVal == null && typeof ele.initial === "function") {
        ele.input = await ele.initial.call(this, this.state, ele, i);
      }
      return ele;
    }
    async onChoice(choice, i) {
      this.emit("choice", choice, i, this);
      if (typeof choice.onChoice === "function") {
        await choice.onChoice.call(this, this.state, choice, i);
      }
    }
    async addChoice(ele, i, parent) {
      let choice = await this.toChoice(ele, i, parent);
      this.choices.push(choice);
      this.index = this.choices.length - 1;
      this.limit = this.choices.length;
      return choice;
    }
    async newItem(item, i, parent) {
      let ele = { name: "New choice name?", editable: true, newChoice: true, ...item };
      let choice = await this.addChoice(ele, i, parent);
      choice.updateChoice = () => {
        delete choice.newChoice;
        choice.name = choice.message = choice.input;
        choice.input = "";
        choice.cursor = 0;
      };
      return this.render();
    }
    indent(choice) {
      if (choice.indent == null) {
        return choice.level > 1 ? "  ".repeat(choice.level - 1) : "";
      }
      return choice.indent;
    }
    dispatch(s, key) {
      if (this.multiple && this[key.name])
        return this[key.name]();
      this.alert();
    }
    focus(choice, enabled) {
      if (typeof enabled !== "boolean")
        enabled = choice.enabled;
      if (enabled && !choice.enabled && this.selected.length >= this.maxSelected) {
        return this.alert();
      }
      this.index = choice.index;
      choice.enabled = enabled && !this.isDisabled(choice);
      return choice;
    }
    space() {
      if (!this.multiple)
        return this.alert();
      if (!this.focused)
        return;
      this.toggle(this.focused);
      return this.render();
    }
    a() {
      if (this.maxSelected < this.choices.length)
        return this.alert();
      let enabled = this.selectable.every((ch) => ch.enabled);
      this.choices.forEach((ch) => ch.enabled = !enabled);
      return this.render();
    }
    i() {
      if (this.choices.length - this.selected.length > this.maxSelected) {
        return this.alert();
      }
      this.choices.forEach((ch) => ch.enabled = !ch.enabled);
      return this.render();
    }
    g() {
      if (!this.choices.some((ch) => !!ch.parent))
        return this.a();
      const focused = this.focused;
      this.toggle(focused.parent && !focused.choices ? focused.parent : focused);
      return this.render();
    }
    toggle(choice, enabled) {
      if (!choice.enabled && this.selected.length >= this.maxSelected) {
        return this.alert();
      }
      if (typeof enabled !== "boolean")
        enabled = !choice.enabled;
      choice.enabled = enabled;
      if (choice.choices) {
        choice.choices.forEach((ch) => this.toggle(ch, enabled));
      }
      let parent = choice.parent;
      while (parent) {
        let choices = parent.choices.filter((ch) => this.isDisabled(ch));
        parent.enabled = choices.every((ch) => ch.enabled === true);
        parent = parent.parent;
      }
      reset(this, this.choices);
      this.emit("toggle", choice, this);
      return choice;
    }
    enable(choice) {
      if (this.selected.length >= this.maxSelected)
        return this.alert();
      choice.enabled = !this.isDisabled(choice);
      choice.choices && choice.choices.forEach(this.enable.bind(this));
      return choice;
    }
    disable(choice) {
      choice.enabled = false;
      choice.choices && choice.choices.forEach(this.disable.bind(this));
      return choice;
    }
    number(n) {
      this.num += n;
      let number = (num) => {
        let i = Number(num);
        if (i > this.choices.length - 1)
          return this.alert();
        let focused = this.focused;
        let choice = this.choices.find((ch) => i === ch.index);
        if (!choice.enabled && this.selected.length >= this.maxSelected) {
          return this.alert();
        }
        if (this.visible.indexOf(choice) === -1) {
          let choices = reorder(this.choices);
          let actualIdx = choices.indexOf(choice);
          if (focused.index > actualIdx) {
            let start = choices.slice(actualIdx, actualIdx + this.limit);
            let end = choices.filter((ch) => !start.includes(ch));
            this.choices = start.concat(end);
          } else {
            let pos = actualIdx - this.limit + 1;
            this.choices = choices.slice(pos).concat(choices.slice(0, pos));
          }
        }
        this.index = this.choices.indexOf(choice);
        this.toggle(this.focused);
        return this.render();
      };
      clearTimeout(this.numberTimeout);
      return new Promise((resolve) => {
        let len = this.choices.length;
        let num = this.num;
        let handle = (val = false, res) => {
          clearTimeout(this.numberTimeout);
          if (val)
            res = number(num);
          this.num = "";
          resolve(res);
        };
        if (num === "0" || num.length === 1 && Number(num + "0") > len) {
          return handle(true);
        }
        if (Number(num) > len) {
          return handle(false, this.alert());
        }
        this.numberTimeout = setTimeout(() => handle(true), this.delay);
      });
    }
    home() {
      this.choices = reorder(this.choices);
      this.index = 0;
      return this.render();
    }
    end() {
      let pos = this.choices.length - this.limit;
      let choices = reorder(this.choices);
      this.choices = choices.slice(pos).concat(choices.slice(0, pos));
      this.index = this.limit - 1;
      return this.render();
    }
    first() {
      this.index = 0;
      return this.render();
    }
    last() {
      this.index = this.visible.length - 1;
      return this.render();
    }
    prev() {
      if (this.visible.length <= 1)
        return this.alert();
      return this.up();
    }
    next() {
      if (this.visible.length <= 1)
        return this.alert();
      return this.down();
    }
    right() {
      if (this.cursor >= this.input.length)
        return this.alert();
      this.cursor++;
      return this.render();
    }
    left() {
      if (this.cursor <= 0)
        return this.alert();
      this.cursor--;
      return this.render();
    }
    up() {
      let len = this.choices.length;
      let vis = this.visible.length;
      let idx = this.index;
      if (this.options.scroll === false && idx === 0) {
        return this.alert();
      }
      if (len > vis && idx === 0) {
        return this.scrollUp();
      }
      this.index = (idx - 1 % len + len) % len;
      if (this.isDisabled() && !this.allChoicesAreDisabled()) {
        return this.up();
      }
      return this.render();
    }
    down() {
      let len = this.choices.length;
      let vis = this.visible.length;
      let idx = this.index;
      if (this.options.scroll === false && idx === vis - 1) {
        return this.alert();
      }
      if (len > vis && idx === vis - 1) {
        return this.scrollDown();
      }
      this.index = (idx + 1) % len;
      if (this.isDisabled() && !this.allChoicesAreDisabled()) {
        return this.down();
      }
      return this.render();
    }
    scrollUp(i = 0) {
      this.choices = scrollUp(this.choices);
      this.index = i;
      if (this.isDisabled()) {
        return this.up();
      }
      return this.render();
    }
    scrollDown(i = this.visible.length - 1) {
      this.choices = scrollDown(this.choices);
      this.index = i;
      if (this.isDisabled()) {
        return this.down();
      }
      return this.render();
    }
    async shiftUp() {
      if (this.options.sort === true) {
        this.sorting = true;
        this.swap(this.index - 1);
        await this.up();
        this.sorting = false;
        return;
      }
      return this.scrollUp(this.index);
    }
    async shiftDown() {
      if (this.options.sort === true) {
        this.sorting = true;
        this.swap(this.index + 1);
        await this.down();
        this.sorting = false;
        return;
      }
      return this.scrollDown(this.index);
    }
    pageUp() {
      if (this.visible.length <= 1)
        return this.alert();
      this.limit = Math.max(this.limit - 1, 0);
      this.index = Math.min(this.limit - 1, this.index);
      this._limit = this.limit;
      if (this.isDisabled()) {
        return this.up();
      }
      return this.render();
    }
    pageDown() {
      if (this.visible.length >= this.choices.length)
        return this.alert();
      this.index = Math.max(0, this.index);
      this.limit = Math.min(this.limit + 1, this.choices.length);
      this._limit = this.limit;
      if (this.isDisabled()) {
        return this.down();
      }
      return this.render();
    }
    swap(pos) {
      swap(this.choices, this.index, pos);
    }
    allChoicesAreDisabled(choices = this.choices) {
      return choices.every((choice) => this.isDisabled(choice));
    }
    isDisabled(choice = this.focused) {
      let keys = ["disabled", "collapsed", "hidden", "completing", "readonly"];
      if (choice && keys.some((key) => choice[key] === true)) {
        return true;
      }
      return choice && choice.role === "heading";
    }
    isEnabled(choice = this.focused) {
      if (Array.isArray(choice))
        return choice.every((ch) => this.isEnabled(ch));
      if (choice.choices) {
        let choices = choice.choices.filter((ch) => !this.isDisabled(ch));
        return choice.enabled && choices.every((ch) => this.isEnabled(ch));
      }
      return choice.enabled && !this.isDisabled(choice);
    }
    isChoice(choice, value) {
      return choice.name === value || choice.index === Number(value);
    }
    isSelected(choice) {
      if (Array.isArray(this.initial)) {
        return this.initial.some((value) => this.isChoice(choice, value));
      }
      return this.isChoice(choice, this.initial);
    }
    map(names = [], prop = "value") {
      return [].concat(names || []).reduce((acc, name) => {
        acc[name] = this.find(name, prop);
        return acc;
      }, {});
    }
    filter(value, prop) {
      let isChoice = (ele, i) => [ele.name, i].includes(value);
      let fn = typeof value === "function" ? value : isChoice;
      let choices = this.options.multiple ? this.state._choices : this.choices;
      let result = choices.filter(fn);
      if (prop) {
        return result.map((ch) => ch[prop]);
      }
      return result;
    }
    find(value, prop) {
      if (isObject(value))
        return prop ? value[prop] : value;
      let isChoice = (ele, i) => [ele.name, i].includes(value);
      let fn = typeof value === "function" ? value : isChoice;
      let choice = this.choices.find(fn);
      if (choice) {
        return prop ? choice[prop] : choice;
      }
    }
    findIndex(value) {
      return this.choices.indexOf(this.find(value));
    }
    async submit() {
      let choice = this.focused;
      if (!choice)
        return this.alert();
      if (choice.newChoice) {
        if (!choice.input)
          return this.alert();
        choice.updateChoice();
        return this.render();
      }
      if (this.choices.some((ch) => ch.newChoice)) {
        return this.alert();
      }
      let { reorder: reorder2, sort } = this.options;
      let multi = this.multiple === true;
      let value = this.selected;
      if (value === undefined) {
        return this.alert();
      }
      if (Array.isArray(value) && reorder2 !== false && sort !== true) {
        value = utils.reorder(value);
      }
      this.value = multi ? value.map((ch) => ch.name) : value.name;
      return super.submit();
    }
    set choices(choices = []) {
      this.state._choices = this.state._choices || [];
      this.state.choices = choices;
      for (let choice of choices) {
        if (!this.state._choices.some((ch) => ch.name === choice.name)) {
          this.state._choices.push(choice);
        }
      }
      if (!this._initial && this.options.initial) {
        this._initial = true;
        let init = this.initial;
        if (typeof init === "string" || typeof init === "number") {
          let choice = this.find(init);
          if (choice) {
            this.initial = choice.index;
            this.focus(choice, true);
          }
        }
      }
    }
    get choices() {
      return reset(this, this.state.choices || []);
    }
    set visible(visible) {
      this.state.visible = visible;
    }
    get visible() {
      return (this.state.visible || this.choices).slice(0, this.limit);
    }
    set limit(num) {
      this.state.limit = num;
    }
    get limit() {
      let { state, options, choices } = this;
      let limit = state.limit || this._limit || options.limit || choices.length;
      return Math.min(limit, this.height);
    }
    set value(value) {
      super.value = value;
    }
    get value() {
      if (typeof super.value !== "string" && super.value === this.initial) {
        return this.input;
      }
      return super.value;
    }
    set index(i) {
      this.state.index = i;
    }
    get index() {
      return Math.max(0, this.state ? this.state.index : 0);
    }
    get enabled() {
      return this.filter(this.isEnabled.bind(this));
    }
    get focused() {
      let choice = this.choices[this.index];
      if (choice && this.state.submitted && this.multiple !== true) {
        choice.enabled = true;
      }
      return choice;
    }
    get selectable() {
      return this.choices.filter((choice) => !this.isDisabled(choice));
    }
    get selected() {
      return this.multiple ? this.enabled : this.focused;
    }
  }
  function reset(prompt, choices) {
    if (choices instanceof Promise)
      return choices;
    if (typeof choices === "function") {
      if (utils.isAsyncFn(choices))
        return choices;
      choices = choices.call(prompt, prompt);
    }
    for (let choice of choices) {
      if (Array.isArray(choice.choices)) {
        let items = choice.choices.filter((ch) => !prompt.isDisabled(ch));
        choice.enabled = items.every((ch) => ch.enabled === true);
      }
      if (prompt.isDisabled(choice) === true) {
        delete choice.enabled;
      }
    }
    return choices;
  }
  module.exports = ArrayPrompt;
});

// node_modules/enquirer/lib/prompts/select.js
var require_select = __commonJS((exports, module) => {
  var ArrayPrompt = require_array();
  var utils = require_utils();

  class SelectPrompt extends ArrayPrompt {
    constructor(options) {
      super(options);
      this.emptyError = this.options.emptyError || "No items were selected";
    }
    async dispatch(s, key) {
      if (this.multiple) {
        return this[key.name] ? await this[key.name](s, key) : await super.dispatch(s, key);
      }
      this.alert();
    }
    separator() {
      if (this.options.separator)
        return super.separator();
      let sep = this.styles.muted(this.symbols.ellipsis);
      return this.state.submitted ? super.separator() : sep;
    }
    pointer(choice, i) {
      return !this.multiple || this.options.pointer ? super.pointer(choice, i) : "";
    }
    indicator(choice, i) {
      return this.multiple ? super.indicator(choice, i) : "";
    }
    choiceMessage(choice, i) {
      let message = this.resolve(choice.message, this.state, choice, i);
      if (choice.role === "heading" && !utils.hasColor(message)) {
        message = this.styles.strong(message);
      }
      return this.resolve(message, this.state, choice, i);
    }
    choiceSeparator() {
      return ":";
    }
    async renderChoice(choice, i) {
      await this.onChoice(choice, i);
      let focused = this.index === i;
      let pointer = await this.pointer(choice, i);
      let check = await this.indicator(choice, i) + (choice.pad || "");
      let hint = await this.resolve(choice.hint, this.state, choice, i);
      if (hint && !utils.hasColor(hint)) {
        hint = this.styles.muted(hint);
      }
      let ind = this.indent(choice);
      let msg = await this.choiceMessage(choice, i);
      let line = () => [this.margin[3], ind + pointer + check, msg, this.margin[1], hint].filter(Boolean).join(" ");
      if (choice.role === "heading") {
        return line();
      }
      if (choice.disabled) {
        if (!utils.hasColor(msg)) {
          msg = this.styles.disabled(msg);
        }
        return line();
      }
      if (focused) {
        msg = this.styles.em(msg);
      }
      return line();
    }
    async renderChoices() {
      if (this.state.loading === "choices") {
        return this.styles.warning("Loading choices");
      }
      if (this.state.submitted)
        return "";
      let choices = this.visible.map(async (ch, i) => await this.renderChoice(ch, i));
      let visible = await Promise.all(choices);
      if (!visible.length)
        visible.push(this.styles.danger("No matching choices"));
      let result = this.margin[0] + visible.join(`
`);
      let header;
      if (this.options.choicesHeader) {
        header = await this.resolve(this.options.choicesHeader, this.state);
      }
      return [header, result].filter(Boolean).join(`
`);
    }
    format() {
      if (!this.state.submitted || this.state.cancelled)
        return "";
      if (Array.isArray(this.selected)) {
        return this.selected.map((choice) => this.styles.primary(choice.name)).join(", ");
      }
      return this.styles.primary(this.selected.name);
    }
    async render() {
      let { submitted, size } = this.state;
      let prompt = "";
      let header = await this.header();
      let prefix = await this.prefix();
      let separator = await this.separator();
      let message = await this.message();
      if (this.options.promptLine !== false) {
        prompt = [prefix, message, separator, ""].join(" ");
        this.state.prompt = prompt;
      }
      let output = await this.format();
      let help = await this.error() || await this.hint();
      let body = await this.renderChoices();
      let footer = await this.footer();
      if (output)
        prompt += output;
      if (help && !prompt.includes(help))
        prompt += " " + help;
      if (submitted && !output && !body.trim() && this.multiple && this.emptyError != null) {
        prompt += this.styles.danger(this.emptyError);
      }
      this.clear(size);
      this.write([header, prompt, body, footer].filter(Boolean).join(`
`));
      this.write(this.margin[2]);
      this.restore();
    }
  }
  module.exports = SelectPrompt;
});

// node_modules/enquirer/lib/prompts/autocomplete.js
var require_autocomplete = __commonJS((exports, module) => {
  var Select = require_select();
  var highlight = (input, color) => {
    const regex = input ? new RegExp(input, "ig") : /$^/;
    return (str) => {
      return input ? str.replace(regex, (match) => color(match)) : str;
    };
  };

  class AutoComplete extends Select {
    constructor(options) {
      super(options);
      this.cursorShow();
    }
    moveCursor(n) {
      this.state.cursor += n;
    }
    dispatch(ch) {
      return this.append(ch);
    }
    space(ch) {
      return this.options.multiple ? super.space(ch) : this.append(ch);
    }
    append(ch) {
      let { cursor, input } = this.state;
      this.input = input.slice(0, cursor) + ch + input.slice(cursor);
      this.moveCursor(1);
      return this.complete();
    }
    delete() {
      let { cursor, input } = this.state;
      if (!input)
        return this.alert();
      this.input = input.slice(0, cursor - 1) + input.slice(cursor);
      this.moveCursor(-1);
      return this.complete();
    }
    deleteForward() {
      let { cursor, input } = this.state;
      if (input[cursor] === undefined)
        return this.alert();
      this.input = `${input}`.slice(0, cursor) + `${input}`.slice(cursor + 1);
      return this.complete();
    }
    number(ch) {
      return this.append(ch);
    }
    async complete() {
      this.completing = true;
      this.choices = await this.suggest(this.input, this.state._choices);
      this.state.limit = undefined;
      this.index = Math.min(Math.max(this.visible.length - 1, 0), this.index);
      await this.render();
      this.completing = false;
    }
    suggest(input = this.input, choices = this.state._choices) {
      if (typeof this.options.suggest === "function") {
        return this.options.suggest.call(this, input, choices);
      }
      let str = input.toLowerCase();
      return choices.filter((ch) => ch.message.toLowerCase().includes(str));
    }
    pointer() {
      return "";
    }
    format() {
      if (!this.focused)
        return this.input;
      if (this.options.multiple && this.state.submitted) {
        return this.selected.map((ch) => this.styles.primary(ch.message)).join(", ");
      }
      if (this.state.submitted) {
        let value = this.value = this.input = this.focused.value;
        return this.styles.primary(value);
      }
      return this.input;
    }
    async render() {
      if (this.state.status !== "pending")
        return super.render();
      const hl = this.options.highlight || this.styles.complement;
      const style = (input, color2) => {
        if (!input)
          return input;
        if (hl.stack)
          return hl(input);
        return hl.call(this, input);
      };
      const color = highlight(this.input, style);
      const choices = this.choices;
      this.choices = choices.map((ch) => ({ ...ch, message: color(ch.message) }));
      await super.render();
      this.choices = choices;
    }
    submit() {
      if (this.options.multiple) {
        this.value = this.selected.map((ch) => ch.name);
      }
      return super.submit();
    }
  }
  module.exports = AutoComplete;
});

// node_modules/enquirer/lib/placeholder.js
var require_placeholder = __commonJS((exports, module) => {
  var utils = require_utils();
  module.exports = (prompt, options = {}) => {
    prompt.cursorHide();
    let { input = "", initial = "", pos, showCursor = true, color } = options;
    let style = color || prompt.styles.placeholder;
    let inverse = utils.inverse(prompt.styles.primary);
    let blinker = (str) => inverse(prompt.styles.black(str));
    let output = input;
    let char = " ";
    let reverse = blinker(char);
    if (prompt.blink && prompt.blink.off === true) {
      blinker = (str) => str;
      reverse = "";
    }
    if (showCursor && pos === 0 && initial === "" && input === "") {
      return blinker(char);
    }
    if (showCursor && pos === 0 && (input === initial || input === "")) {
      return blinker(initial[0]) + style(initial.slice(1));
    }
    initial = utils.isPrimitive(initial) ? `${initial}` : "";
    input = utils.isPrimitive(input) ? `${input}` : "";
    let placeholder = initial && initial.startsWith(input) && initial !== input;
    let cursor = placeholder ? blinker(initial[input.length]) : reverse;
    if (pos !== input.length && showCursor === true) {
      output = input.slice(0, pos) + blinker(input[pos]) + input.slice(pos + 1);
      cursor = "";
    }
    if (showCursor === false) {
      cursor = "";
    }
    if (placeholder) {
      let raw = prompt.styles.unstyle(output + cursor);
      return output + cursor + style(initial.slice(raw.length));
    }
    return output + cursor;
  };
});

// node_modules/enquirer/lib/prompts/form.js
var require_form = __commonJS((exports, module) => {
  var stripAnsi = require_strip_ansi();
  var SelectPrompt = require_select();
  var placeholder = require_placeholder();

  class FormPrompt extends SelectPrompt {
    constructor(options) {
      super({ ...options, multiple: true });
      this.type = "form";
      this.initial = this.options.initial;
      this.align = [this.options.align, "right"].find((v) => v != null);
      this.emptyError = "";
      this.values = {};
    }
    async reset(first) {
      await super.reset();
      if (first === true)
        this._index = this.index;
      this.index = this._index;
      this.values = {};
      this.choices.forEach((choice) => choice.reset && choice.reset());
      return this.render();
    }
    dispatch(char) {
      return !!char && this.append(char);
    }
    append(char) {
      let choice = this.focused;
      if (!choice)
        return this.alert();
      let { cursor, input } = choice;
      choice.value = choice.input = input.slice(0, cursor) + char + input.slice(cursor);
      choice.cursor++;
      return this.render();
    }
    delete() {
      let choice = this.focused;
      if (!choice || choice.cursor <= 0)
        return this.alert();
      let { cursor, input } = choice;
      choice.value = choice.input = input.slice(0, cursor - 1) + input.slice(cursor);
      choice.cursor--;
      return this.render();
    }
    deleteForward() {
      let choice = this.focused;
      if (!choice)
        return this.alert();
      let { cursor, input } = choice;
      if (input[cursor] === undefined)
        return this.alert();
      let str = `${input}`.slice(0, cursor) + `${input}`.slice(cursor + 1);
      choice.value = choice.input = str;
      return this.render();
    }
    right() {
      let choice = this.focused;
      if (!choice)
        return this.alert();
      if (choice.cursor >= choice.input.length)
        return this.alert();
      choice.cursor++;
      return this.render();
    }
    left() {
      let choice = this.focused;
      if (!choice)
        return this.alert();
      if (choice.cursor <= 0)
        return this.alert();
      choice.cursor--;
      return this.render();
    }
    space(ch, key) {
      return this.dispatch(ch, key);
    }
    number(ch, key) {
      return this.dispatch(ch, key);
    }
    next() {
      let ch = this.focused;
      if (!ch)
        return this.alert();
      let { initial, input } = ch;
      if (initial && initial.startsWith(input) && input !== initial) {
        ch.value = ch.input = initial;
        ch.cursor = ch.value.length;
        return this.render();
      }
      return super.next();
    }
    prev() {
      let ch = this.focused;
      if (!ch)
        return this.alert();
      if (ch.cursor === 0)
        return super.prev();
      ch.value = ch.input = "";
      ch.cursor = 0;
      return this.render();
    }
    separator() {
      return "";
    }
    format(value) {
      return !this.state.submitted ? super.format(value) : "";
    }
    pointer() {
      return "";
    }
    indicator(choice) {
      return choice.input ? "⦿" : "⊙";
    }
    async choiceSeparator(choice, i) {
      let sep = await this.resolve(choice.separator, this.state, choice, i) || ":";
      return sep ? " " + this.styles.disabled(sep) : "";
    }
    async renderChoice(choice, i) {
      await this.onChoice(choice, i);
      let { state, styles } = this;
      let { cursor, initial = "", name, input = "" } = choice;
      let { muted, submitted, primary, danger } = styles;
      let focused = this.index === i;
      let validate = choice.validate || (() => true);
      let sep = await this.choiceSeparator(choice, i);
      let msg = choice.message;
      if (this.align === "right")
        msg = msg.padStart(this.longest + 1, " ");
      if (this.align === "left")
        msg = msg.padEnd(this.longest + 1, " ");
      let value = this.values[name] = input || initial;
      let color = input ? "success" : "dark";
      if (await validate.call(choice, value, this.state) !== true) {
        color = "danger";
      }
      let style = styles[color];
      let indicator = style(await this.indicator(choice, i)) + (choice.pad || "");
      let indent = this.indent(choice);
      let line = () => [indent, indicator, msg + sep, input].filter(Boolean).join(" ");
      if (state.submitted) {
        msg = stripAnsi(msg);
        input = submitted(input);
        return line();
      }
      if (choice.format) {
        input = await choice.format.call(this, input, choice, i);
      } else {
        let color2 = this.styles.muted;
        let options = { input, initial, pos: cursor, showCursor: focused, color: color2 };
        input = placeholder(this, options);
      }
      if (!this.isValue(input)) {
        input = this.styles.muted(this.symbols.ellipsis);
      }
      if (choice.result) {
        this.values[name] = await choice.result.call(this, value, choice, i);
      }
      if (focused) {
        msg = primary(msg);
      }
      if (choice.error) {
        input += (input ? " " : "") + danger(choice.error.trim());
      } else if (choice.hint) {
        input += (input ? " " : "") + muted(choice.hint.trim());
      }
      return line();
    }
    async submit() {
      this.value = this.values;
      return super.base.submit.call(this);
    }
  }
  module.exports = FormPrompt;
});

// node_modules/enquirer/lib/types/auth.js
var require_auth = __commonJS((exports, module) => {
  var FormPrompt = require_form();
  var defaultAuthenticate = () => {
    throw new Error("expected prompt to have a custom authenticate method");
  };
  var factory = (authenticate = defaultAuthenticate) => {

    class AuthPrompt extends FormPrompt {
      constructor(options) {
        super(options);
      }
      async submit() {
        this.value = await authenticate.call(this, this.values, this.state);
        super.base.submit.call(this);
      }
      static create(authenticate2) {
        return factory(authenticate2);
      }
    }
    return AuthPrompt;
  };
  module.exports = factory();
});

// node_modules/enquirer/lib/prompts/basicauth.js
var require_basicauth = __commonJS((exports, module) => {
  var AuthPrompt = require_auth();
  function defaultAuthenticate(value, state) {
    if (value.username === this.options.username && value.password === this.options.password) {
      return true;
    }
    return false;
  }
  var factory = (authenticate = defaultAuthenticate) => {
    const choices = [
      { name: "username", message: "username" },
      {
        name: "password",
        message: "password",
        format(input) {
          if (this.options.showPassword) {
            return input;
          }
          let color = this.state.submitted ? this.styles.primary : this.styles.muted;
          return color(this.symbols.asterisk.repeat(input.length));
        }
      }
    ];

    class BasicAuthPrompt extends AuthPrompt.create(authenticate) {
      constructor(options) {
        super({ ...options, choices });
      }
      static create(authenticate2) {
        return factory(authenticate2);
      }
    }
    return BasicAuthPrompt;
  };
  module.exports = factory();
});

// node_modules/enquirer/lib/types/boolean.js
var require_boolean = __commonJS((exports, module) => {
  var Prompt = require_prompt();
  var { isPrimitive, hasColor } = require_utils();

  class BooleanPrompt extends Prompt {
    constructor(options) {
      super(options);
      this.cursorHide();
    }
    async initialize() {
      let initial = await this.resolve(this.initial, this.state);
      this.input = await this.cast(initial);
      await super.initialize();
    }
    dispatch(ch) {
      if (!this.isValue(ch))
        return this.alert();
      this.input = ch;
      return this.submit();
    }
    format(value) {
      let { styles, state } = this;
      return !state.submitted ? styles.primary(value) : styles.success(value);
    }
    cast(input) {
      return this.isTrue(input);
    }
    isTrue(input) {
      return /^[ty1]/i.test(input);
    }
    isFalse(input) {
      return /^[fn0]/i.test(input);
    }
    isValue(value) {
      return isPrimitive(value) && (this.isTrue(value) || this.isFalse(value));
    }
    async hint() {
      if (this.state.status === "pending") {
        let hint = await this.element("hint");
        if (!hasColor(hint)) {
          return this.styles.muted(hint);
        }
        return hint;
      }
    }
    async render() {
      let { input, size } = this.state;
      let prefix = await this.prefix();
      let sep = await this.separator();
      let msg = await this.message();
      let hint = this.styles.muted(this.default);
      let promptLine = [prefix, msg, hint, sep].filter(Boolean).join(" ");
      this.state.prompt = promptLine;
      let header = await this.header();
      let value = this.value = this.cast(input);
      let output = await this.format(value);
      let help = await this.error() || await this.hint();
      let footer = await this.footer();
      if (help && !promptLine.includes(help))
        output += " " + help;
      promptLine += " " + output;
      this.clear(size);
      this.write([header, promptLine, footer].filter(Boolean).join(`
`));
      this.restore();
    }
    set value(value) {
      super.value = value;
    }
    get value() {
      return this.cast(super.value);
    }
  }
  module.exports = BooleanPrompt;
});

// node_modules/enquirer/lib/prompts/confirm.js
var require_confirm = __commonJS((exports, module) => {
  var BooleanPrompt = require_boolean();

  class ConfirmPrompt extends BooleanPrompt {
    constructor(options) {
      super(options);
      this.default = this.options.default || (this.initial ? "(Y/n)" : "(y/N)");
    }
  }
  module.exports = ConfirmPrompt;
});

// node_modules/enquirer/lib/prompts/editable.js
var require_editable = __commonJS((exports, module) => {
  var Select = require_select();
  var Form = require_form();
  var form = Form.prototype;

  class Editable extends Select {
    constructor(options) {
      super({ ...options, multiple: true });
      this.align = [this.options.align, "left"].find((v) => v != null);
      this.emptyError = "";
      this.values = {};
    }
    dispatch(char, key) {
      let choice = this.focused;
      let parent = choice.parent || {};
      if (!choice.editable && !parent.editable) {
        if (char === "a" || char === "i")
          return super[char]();
      }
      return form.dispatch.call(this, char, key);
    }
    append(char, key) {
      return form.append.call(this, char, key);
    }
    delete(char, key) {
      return form.delete.call(this, char, key);
    }
    space(char) {
      return this.focused.editable ? this.append(char) : super.space();
    }
    number(char) {
      return this.focused.editable ? this.append(char) : super.number(char);
    }
    next() {
      return this.focused.editable ? form.next.call(this) : super.next();
    }
    prev() {
      return this.focused.editable ? form.prev.call(this) : super.prev();
    }
    async indicator(choice, i) {
      let symbol = choice.indicator || "";
      let value = choice.editable ? symbol : super.indicator(choice, i);
      return await this.resolve(value, this.state, choice, i) || "";
    }
    indent(choice) {
      return choice.role === "heading" ? "" : choice.editable ? " " : "  ";
    }
    async renderChoice(choice, i) {
      choice.indent = "";
      if (choice.editable)
        return form.renderChoice.call(this, choice, i);
      return super.renderChoice(choice, i);
    }
    error() {
      return "";
    }
    footer() {
      return this.state.error;
    }
    async validate() {
      let result = true;
      for (let choice of this.choices) {
        if (typeof choice.validate !== "function") {
          continue;
        }
        if (choice.role === "heading") {
          continue;
        }
        let val = choice.parent ? this.value[choice.parent.name] : this.value;
        if (choice.editable) {
          val = choice.value === choice.name ? choice.initial || "" : choice.value;
        } else if (!this.isDisabled(choice)) {
          val = choice.enabled === true;
        }
        result = await choice.validate(val, this.state);
        if (result !== true) {
          break;
        }
      }
      if (result !== true) {
        this.state.error = typeof result === "string" ? result : "Invalid Input";
      }
      return result;
    }
    submit() {
      if (this.focused.newChoice === true)
        return super.submit();
      if (this.choices.some((ch) => ch.newChoice)) {
        return this.alert();
      }
      this.value = {};
      for (let choice of this.choices) {
        let val = choice.parent ? this.value[choice.parent.name] : this.value;
        if (choice.role === "heading") {
          this.value[choice.name] = {};
          continue;
        }
        if (choice.editable) {
          val[choice.name] = choice.value === choice.name ? choice.initial || "" : choice.value;
        } else if (!this.isDisabled(choice)) {
          val[choice.name] = choice.enabled === true;
        }
      }
      return this.base.submit.call(this);
    }
  }
  module.exports = Editable;
});

// node_modules/enquirer/lib/types/string.js
var require_string2 = __commonJS((exports, module) => {
  var Prompt = require_prompt();
  var keypress = require_keypress();
  var placeholder = require_placeholder();
  var { isPrimitive } = require_utils();

  class StringPrompt extends Prompt {
    constructor(options) {
      super(options);
      this.initial = isPrimitive(this.initial) ? String(this.initial) : "";
      if (this.initial)
        this.cursorHide();
      this.state.prevCursor = 0;
      this.state.clipboard = [];
      this.keypressTimeout = this.options.keypressTimeout !== undefined ? this.options.keypressTimeout : null;
    }
    async keypress(input, key = input ? keypress(input, {}) : {}) {
      const now = Date.now();
      const elapsed = now - this.lastKeypress;
      this.lastKeypress = now;
      const isEnterKey = key.name === "return" || key.name === "enter";
      let prev = this.state.prevKeypress;
      let append;
      this.state.prevKeypress = key;
      if (this.keypressTimeout != null && isEnterKey) {
        if (elapsed < this.keypressTimeout) {
          return this.submit();
        }
        this.state.multilineBuffer = this.state.multilineBuffer || "";
        this.state.multilineBuffer += input;
        append = true;
        prev = null;
      }
      if (append || this.options.multiline && isEnterKey) {
        if (!prev || prev.name !== "return") {
          return this.append(`
`, key);
        }
      }
      return super.keypress(input, key);
    }
    moveCursor(n) {
      this.cursor += n;
    }
    reset() {
      this.input = this.value = "";
      this.cursor = 0;
      return this.render();
    }
    dispatch(ch, key) {
      if (!ch || key.ctrl || key.code)
        return this.alert();
      this.append(ch);
    }
    append(ch) {
      let { cursor, input } = this.state;
      this.input = `${input}`.slice(0, cursor) + ch + `${input}`.slice(cursor);
      this.moveCursor(String(ch).length);
      this.render();
    }
    insert(str) {
      this.append(str);
    }
    delete() {
      let { cursor, input } = this.state;
      if (cursor <= 0)
        return this.alert();
      this.input = `${input}`.slice(0, cursor - 1) + `${input}`.slice(cursor);
      this.moveCursor(-1);
      this.render();
    }
    deleteForward() {
      let { cursor, input } = this.state;
      if (input[cursor] === undefined)
        return this.alert();
      this.input = `${input}`.slice(0, cursor) + `${input}`.slice(cursor + 1);
      this.render();
    }
    cutForward() {
      let pos = this.cursor;
      if (this.input.length <= pos)
        return this.alert();
      this.state.clipboard.push(this.input.slice(pos));
      this.input = this.input.slice(0, pos);
      this.render();
    }
    cutLeft() {
      let pos = this.cursor;
      if (pos === 0)
        return this.alert();
      let before = this.input.slice(0, pos);
      let after = this.input.slice(pos);
      let words = before.split(" ");
      this.state.clipboard.push(words.pop());
      this.input = words.join(" ");
      this.cursor = this.input.length;
      this.input += after;
      this.render();
    }
    paste() {
      if (!this.state.clipboard.length)
        return this.alert();
      this.insert(this.state.clipboard.pop());
      this.render();
    }
    toggleCursor() {
      if (this.state.prevCursor) {
        this.cursor = this.state.prevCursor;
        this.state.prevCursor = 0;
      } else {
        this.state.prevCursor = this.cursor;
        this.cursor = 0;
      }
      this.render();
    }
    first() {
      this.cursor = 0;
      this.render();
    }
    last() {
      this.cursor = this.input.length - 1;
      this.render();
    }
    next() {
      let init = this.initial != null ? String(this.initial) : "";
      if (!init || !init.startsWith(this.input))
        return this.alert();
      this.input = this.initial;
      this.cursor = this.initial.length;
      this.render();
    }
    prev() {
      if (!this.input)
        return this.alert();
      this.reset();
    }
    backward() {
      return this.left();
    }
    forward() {
      return this.right();
    }
    right() {
      if (this.cursor >= this.input.length)
        return this.alert();
      this.moveCursor(1);
      return this.render();
    }
    left() {
      if (this.cursor <= 0)
        return this.alert();
      this.moveCursor(-1);
      return this.render();
    }
    isValue(value) {
      return !!value;
    }
    async format(input = this.value) {
      let initial = await this.resolve(this.initial, this.state);
      if (!this.state.submitted) {
        return placeholder(this, { input, initial, pos: this.cursor });
      }
      return this.styles.submitted(input || initial);
    }
    async render() {
      let size = this.state.size;
      let prefix = await this.prefix();
      let separator = await this.separator();
      let message = await this.message();
      let prompt = [prefix, message, separator].filter(Boolean).join(" ");
      this.state.prompt = prompt;
      let header = await this.header();
      let output = await this.format();
      let help = await this.error() || await this.hint();
      let footer = await this.footer();
      if (help && !output.includes(help))
        output += " " + help;
      prompt += " " + output;
      this.clear(size);
      this.write([header, prompt, footer].filter(Boolean).join(`
`));
      this.restore();
    }
  }
  module.exports = StringPrompt;
});

// node_modules/enquirer/lib/completer.js
var require_completer = __commonJS((exports, module) => {
  var unique = (arr) => arr.filter((v, i) => arr.lastIndexOf(v) === i);
  var compact = (arr) => unique(arr).filter(Boolean);
  module.exports = (action, data = {}, value = "") => {
    let { past = [], present = "" } = data;
    let rest, prev;
    switch (action) {
      case "prev":
      case "undo":
        rest = past.slice(0, past.length - 1);
        prev = past[past.length - 1] || "";
        return {
          past: compact([value, ...rest]),
          present: prev
        };
      case "next":
      case "redo":
        rest = past.slice(1);
        prev = past[0] || "";
        return {
          past: compact([...rest, value]),
          present: prev
        };
      case "save":
        return {
          past: compact([...past, value]),
          present: ""
        };
      case "remove":
        prev = compact(past.filter((v) => v !== value));
        present = "";
        if (prev.length) {
          present = prev.pop();
        }
        return {
          past: prev,
          present
        };
      default: {
        throw new Error(`Invalid action: "${action}"`);
      }
    }
  };
});

// node_modules/enquirer/lib/prompts/input.js
var require_input = __commonJS((exports, module) => {
  var Prompt = require_string2();
  var completer = require_completer();

  class Input extends Prompt {
    constructor(options) {
      super(options);
      let history = this.options.history;
      if (history && history.store) {
        let initial = history.values || this.initial;
        this.autosave = !!history.autosave;
        this.store = history.store;
        this.data = this.store.get("values") || { past: [], present: initial };
        this.initial = this.data.present || this.data.past[this.data.past.length - 1];
      }
    }
    completion(action) {
      if (!this.store)
        return this.alert();
      this.data = completer(action, this.data, this.input);
      if (!this.data.present)
        return this.alert();
      this.input = this.data.present;
      this.cursor = this.input.length;
      return this.render();
    }
    altUp() {
      return this.completion("prev");
    }
    altDown() {
      return this.completion("next");
    }
    prev() {
      this.save();
      return super.prev();
    }
    save() {
      if (!this.store)
        return;
      this.data = completer("save", this.data, this.input);
      this.store.set("values", this.data);
    }
    submit() {
      if (this.store && this.autosave === true) {
        this.save();
      }
      return super.submit();
    }
  }
  module.exports = Input;
});

// node_modules/enquirer/lib/prompts/invisible.js
var require_invisible = __commonJS((exports, module) => {
  var StringPrompt = require_string2();

  class InvisiblePrompt extends StringPrompt {
    format() {
      return "";
    }
  }
  module.exports = InvisiblePrompt;
});

// node_modules/enquirer/lib/prompts/list.js
var require_list = __commonJS((exports, module) => {
  var StringPrompt = require_string2();

  class ListPrompt extends StringPrompt {
    constructor(options = {}) {
      super(options);
      this.sep = this.options.separator || /, */;
      this.initial = options.initial || "";
    }
    split(input = this.value) {
      return input ? String(input).split(this.sep) : [];
    }
    format() {
      let style = this.state.submitted ? this.styles.primary : (val) => val;
      return this.list.map(style).join(", ");
    }
    async submit(value) {
      let result = this.state.error || await this.validate(this.list, this.state);
      if (result !== true) {
        this.state.error = result;
        return super.submit();
      }
      this.value = this.list;
      return super.submit();
    }
    get list() {
      return this.split();
    }
  }
  module.exports = ListPrompt;
});

// node_modules/enquirer/lib/prompts/multiselect.js
var require_multiselect = __commonJS((exports, module) => {
  var Select = require_select();

  class MultiSelect extends Select {
    constructor(options) {
      super({ ...options, multiple: true });
    }
  }
  module.exports = MultiSelect;
});

// node_modules/enquirer/lib/types/number.js
var require_number = __commonJS((exports, module) => {
  var StringPrompt = require_string2();

  class NumberPrompt extends StringPrompt {
    constructor(options = {}) {
      super({ style: "number", ...options });
      this.min = this.isValue(options.min) ? this.toNumber(options.min) : -Infinity;
      this.max = this.isValue(options.max) ? this.toNumber(options.max) : Infinity;
      this.delay = options.delay != null ? options.delay : 1000;
      this.float = options.float !== false;
      this.round = options.round === true || options.float === false;
      this.major = options.major || 10;
      this.minor = options.minor || 1;
      this.initial = options.initial != null ? options.initial : "";
      this.input = String(this.initial);
      this.cursor = this.input.length;
      this.cursorShow();
    }
    append(ch) {
      if (!/[-+.]/.test(ch) || ch === "." && this.input.includes(".")) {
        return this.alert("invalid number");
      }
      return super.append(ch);
    }
    number(ch) {
      return super.append(ch);
    }
    next() {
      if (this.input && this.input !== this.initial)
        return this.alert();
      if (!this.isValue(this.initial))
        return this.alert();
      this.input = this.initial;
      this.cursor = String(this.initial).length;
      return this.render();
    }
    up(number) {
      let step = number || this.minor;
      let num = this.toNumber(this.input);
      if (num > this.max + step)
        return this.alert();
      this.input = `${num + step}`;
      return this.render();
    }
    down(number) {
      let step = number || this.minor;
      let num = this.toNumber(this.input);
      if (num < this.min - step)
        return this.alert();
      this.input = `${num - step}`;
      return this.render();
    }
    shiftDown() {
      return this.down(this.major);
    }
    shiftUp() {
      return this.up(this.major);
    }
    format(input = this.input) {
      if (typeof this.options.format === "function") {
        return this.options.format.call(this, input);
      }
      return this.styles.info(input);
    }
    toNumber(value = "") {
      return this.float ? +value : Math.round(+value);
    }
    isValue(value) {
      return /^[-+]?[0-9]+((\.)|(\.[0-9]+))?$/.test(value);
    }
    submit() {
      let value = [this.input, this.initial].find((v) => this.isValue(v));
      this.value = this.toNumber(value || 0);
      return super.submit();
    }
  }
  module.exports = NumberPrompt;
});

// node_modules/enquirer/lib/prompts/password.js
var require_password = __commonJS((exports, module) => {
  var StringPrompt = require_string2();

  class PasswordPrompt extends StringPrompt {
    constructor(options) {
      super(options);
      this.cursorShow();
    }
    format(input = this.input) {
      if (!this.keypressed)
        return "";
      let color = this.state.submitted ? this.styles.primary : this.styles.muted;
      return color(this.symbols.asterisk.repeat(input.length));
    }
  }
  module.exports = PasswordPrompt;
});

// node_modules/enquirer/lib/prompts/scale.js
var require_scale = __commonJS((exports, module) => {
  var stripAnsi = require_strip_ansi();
  var ArrayPrompt = require_array();
  var utils = require_utils();

  class LikertScale extends ArrayPrompt {
    constructor(options = {}) {
      super(options);
      this.widths = [].concat(options.messageWidth || 50);
      this.align = [].concat(options.align || "left");
      this.linebreak = options.linebreak || false;
      this.edgeLength = options.edgeLength || 3;
      this.newline = options.newline || `
   `;
      let start = options.startNumber || 1;
      if (typeof this.scale === "number") {
        this.scaleKey = false;
        this.scale = Array(this.scale).fill(0).map((v, i) => ({ name: i + start }));
      }
    }
    async reset() {
      this.tableized = false;
      await super.reset();
      return this.render();
    }
    tableize() {
      if (this.tableized === true)
        return;
      this.tableized = true;
      let longest = 0;
      for (let ch of this.choices) {
        longest = Math.max(longest, ch.message.length);
        ch.scaleIndex = ch.initial || 2;
        ch.scale = [];
        for (let i = 0;i < this.scale.length; i++) {
          ch.scale.push({ index: i });
        }
      }
      this.widths[0] = Math.min(this.widths[0], longest + 3);
    }
    async dispatch(s, key) {
      if (this.multiple) {
        return this[key.name] ? await this[key.name](s, key) : await super.dispatch(s, key);
      }
      this.alert();
    }
    heading(msg, item, i) {
      return this.styles.strong(msg);
    }
    separator() {
      return this.styles.muted(this.symbols.ellipsis);
    }
    right() {
      let choice = this.focused;
      if (choice.scaleIndex >= this.scale.length - 1)
        return this.alert();
      choice.scaleIndex++;
      return this.render();
    }
    left() {
      let choice = this.focused;
      if (choice.scaleIndex <= 0)
        return this.alert();
      choice.scaleIndex--;
      return this.render();
    }
    indent() {
      return "";
    }
    format() {
      if (this.state.submitted) {
        let values = this.choices.map((ch) => this.styles.info(ch.index));
        return values.join(", ");
      }
      return "";
    }
    pointer() {
      return "";
    }
    renderScaleKey() {
      if (this.scaleKey === false)
        return "";
      if (this.state.submitted)
        return "";
      let scale = this.scale.map((item) => `   ${item.name} - ${item.message}`);
      let key = ["", ...scale].map((item) => this.styles.muted(item));
      return key.join(`
`);
    }
    renderScaleHeading(max) {
      let keys = this.scale.map((ele) => ele.name);
      if (typeof this.options.renderScaleHeading === "function") {
        keys = this.options.renderScaleHeading.call(this, max);
      }
      let diff = this.scaleLength - keys.join("").length;
      let spacing = Math.round(diff / (keys.length - 1));
      let names = keys.map((key) => this.styles.strong(key));
      let headings = names.join(" ".repeat(spacing));
      let padding = " ".repeat(this.widths[0]);
      return this.margin[3] + padding + this.margin[1] + headings;
    }
    scaleIndicator(choice, item, i) {
      if (typeof this.options.scaleIndicator === "function") {
        return this.options.scaleIndicator.call(this, choice, item, i);
      }
      let enabled = choice.scaleIndex === item.index;
      if (item.disabled)
        return this.styles.hint(this.symbols.radio.disabled);
      if (enabled)
        return this.styles.success(this.symbols.radio.on);
      return this.symbols.radio.off;
    }
    renderScale(choice, i) {
      let scale = choice.scale.map((item) => this.scaleIndicator(choice, item, i));
      let padding = this.term === "Hyper" ? "" : " ";
      return scale.join(padding + this.symbols.line.repeat(this.edgeLength));
    }
    async renderChoice(choice, i) {
      await this.onChoice(choice, i);
      let focused = this.index === i;
      let pointer = await this.pointer(choice, i);
      let hint = await choice.hint;
      if (hint && !utils.hasColor(hint)) {
        hint = this.styles.muted(hint);
      }
      let pad = (str) => this.margin[3] + str.replace(/\s+$/, "").padEnd(this.widths[0], " ");
      let newline = this.newline;
      let ind = this.indent(choice);
      let message = await this.resolve(choice.message, this.state, choice, i);
      let scale = await this.renderScale(choice, i);
      let margin = this.margin[1] + this.margin[3];
      this.scaleLength = stripAnsi(scale).length;
      this.widths[0] = Math.min(this.widths[0], this.width - this.scaleLength - margin.length);
      let msg = utils.wordWrap(message, { width: this.widths[0], newline });
      let lines = msg.split(`
`).map((line) => pad(line) + this.margin[1]);
      if (focused) {
        scale = this.styles.info(scale);
        lines = lines.map((line) => this.styles.info(line));
      }
      lines[0] += scale;
      if (this.linebreak)
        lines.push("");
      return [ind + pointer, lines.join(`
`)].filter(Boolean);
    }
    async renderChoices() {
      if (this.state.submitted)
        return "";
      this.tableize();
      let choices = this.visible.map(async (ch, i) => await this.renderChoice(ch, i));
      let visible = await Promise.all(choices);
      let heading = await this.renderScaleHeading();
      return this.margin[0] + [heading, ...visible.map((v) => v.join(" "))].join(`
`);
    }
    async render() {
      let { submitted, size } = this.state;
      let prefix = await this.prefix();
      let separator = await this.separator();
      let message = await this.message();
      let prompt = "";
      if (this.options.promptLine !== false) {
        prompt = [prefix, message, separator, ""].join(" ");
        this.state.prompt = prompt;
      }
      let header = await this.header();
      let output = await this.format();
      let key = await this.renderScaleKey();
      let help = await this.error() || await this.hint();
      let body = await this.renderChoices();
      let footer = await this.footer();
      let err = this.emptyError;
      if (output)
        prompt += output;
      if (help && !prompt.includes(help))
        prompt += " " + help;
      if (submitted && !output && !body.trim() && this.multiple && err != null) {
        prompt += this.styles.danger(err);
      }
      this.clear(size);
      this.write([header, prompt, key, body, footer].filter(Boolean).join(`
`));
      if (!this.state.submitted) {
        this.write(this.margin[2]);
      }
      this.restore();
    }
    submit() {
      this.value = {};
      for (let choice of this.choices) {
        this.value[choice.name] = choice.scaleIndex;
      }
      return this.base.submit.call(this);
    }
  }
  module.exports = LikertScale;
});

// node_modules/enquirer/lib/interpolate.js
var require_interpolate = __commonJS((exports, module) => {
  var stripAnsi = require_strip_ansi();
  var clean = (str = "") => {
    return typeof str === "string" ? str.replace(/^['"]|['"]$/g, "") : "";
  };

  class Item {
    constructor(token) {
      this.name = token.key;
      this.field = token.field || {};
      this.value = clean(token.initial || this.field.initial || "");
      this.message = token.message || this.name;
      this.cursor = 0;
      this.input = "";
      this.lines = [];
    }
  }
  var tokenize = async (options = {}, defaults = {}, fn = (token) => token) => {
    let unique = new Set;
    let fields = options.fields || [];
    let input = options.template;
    let tabstops = [];
    let items = [];
    let keys = [];
    let line = 1;
    if (typeof input === "function") {
      input = await input();
    }
    let i = -1;
    let next = () => input[++i];
    let peek = () => input[i + 1];
    let push = (token) => {
      token.line = line;
      tabstops.push(token);
    };
    push({ type: "bos", value: "" });
    while (i < input.length - 1) {
      let value = next();
      if (/^[^\S\n ]$/.test(value)) {
        push({ type: "text", value });
        continue;
      }
      if (value === `
`) {
        push({ type: "newline", value });
        line++;
        continue;
      }
      if (value === "\\") {
        value += next();
        push({ type: "text", value });
        continue;
      }
      if ((value === "$" || value === "#" || value === "{") && peek() === "{") {
        let n = next();
        value += n;
        let token = { type: "template", open: value, inner: "", close: "", value };
        let ch;
        while (ch = next()) {
          if (ch === "}") {
            if (peek() === "}")
              ch += next();
            token.value += ch;
            token.close = ch;
            break;
          }
          if (ch === ":") {
            token.initial = "";
            token.key = token.inner;
          } else if (token.initial !== undefined) {
            token.initial += ch;
          }
          token.value += ch;
          token.inner += ch;
        }
        token.template = token.open + (token.initial || token.inner) + token.close;
        token.key = token.key || token.inner;
        if (hasOwnProperty.call(defaults, token.key)) {
          token.initial = defaults[token.key];
        }
        token = fn(token);
        push(token);
        keys.push(token.key);
        unique.add(token.key);
        let item = items.find((item2) => item2.name === token.key);
        token.field = fields.find((ch2) => ch2.name === token.key);
        if (!item) {
          item = new Item(token);
          items.push(item);
        }
        item.lines.push(token.line - 1);
        continue;
      }
      let last = tabstops[tabstops.length - 1];
      if (last.type === "text" && last.line === line) {
        last.value += value;
      } else {
        push({ type: "text", value });
      }
    }
    push({ type: "eos", value: "" });
    return { input, tabstops, unique, keys, items };
  };
  module.exports = async (prompt) => {
    let options = prompt.options;
    let required = new Set(options.required === true ? [] : options.required || []);
    let defaults = { ...options.values, ...options.initial };
    let { tabstops, items, keys } = await tokenize(options, defaults);
    let result = createFn("result", prompt, options);
    let format = createFn("format", prompt, options);
    let isValid = createFn("validate", prompt, options, true);
    let isVal = prompt.isValue.bind(prompt);
    return async (state = {}, submitted = false) => {
      let index = 0;
      state.required = required;
      state.items = items;
      state.keys = keys;
      state.output = "";
      let validate = async (value, state2, item, index2) => {
        let error = await isValid(value, state2, item, index2);
        if (error === false) {
          return "Invalid field " + item.name;
        }
        return error;
      };
      for (let token of tabstops) {
        let value = token.value;
        let key = token.key;
        if (token.type !== "template") {
          if (value)
            state.output += value;
          continue;
        }
        if (token.type === "template") {
          let item = items.find((ch) => ch.name === key);
          if (options.required === true) {
            state.required.add(item.name);
          }
          let val = [item.input, state.values[item.value], item.value, value].find(isVal);
          let field = item.field || {};
          let message = field.message || token.inner;
          if (submitted) {
            let error = await validate(state.values[key], state, item, index);
            if (error && typeof error === "string" || error === false) {
              state.invalid.set(key, error);
              continue;
            }
            state.invalid.delete(key);
            let res = await result(state.values[key], state, item, index);
            state.output += stripAnsi(res);
            continue;
          }
          item.placeholder = false;
          let before = value;
          value = await format(value, state, item, index);
          if (val !== value) {
            state.values[key] = val;
            value = prompt.styles.typing(val);
            state.missing.delete(message);
          } else {
            state.values[key] = undefined;
            val = `<${message}>`;
            value = prompt.styles.primary(val);
            item.placeholder = true;
            if (state.required.has(key)) {
              state.missing.add(message);
            }
          }
          if (state.missing.has(message) && state.validating) {
            value = prompt.styles.warning(val);
          }
          if (state.invalid.has(key) && state.validating) {
            value = prompt.styles.danger(val);
          }
          if (index === state.index) {
            if (before !== value) {
              value = prompt.styles.underline(value);
            } else {
              value = prompt.styles.heading(stripAnsi(value));
            }
          }
          index++;
        }
        if (value) {
          state.output += value;
        }
      }
      let lines = state.output.split(`
`).map((l) => " " + l);
      let len = items.length;
      let done = 0;
      for (let item of items) {
        if (state.invalid.has(item.name)) {
          item.lines.forEach((i) => {
            if (lines[i][0] !== " ")
              return;
            lines[i] = state.styles.danger(state.symbols.bullet) + lines[i].slice(1);
          });
        }
        if (prompt.isValue(state.values[item.name])) {
          done++;
        }
      }
      state.completed = (done / len * 100).toFixed(0);
      state.output = lines.join(`
`);
      return state.output;
    };
  };
  function createFn(prop, prompt, options, fallback) {
    return (value, state, item, index) => {
      if (typeof item.field[prop] === "function") {
        return item.field[prop].call(prompt, value, state, item, index);
      }
      return [fallback, value].find((v) => prompt.isValue(v));
    };
  }
});

// node_modules/enquirer/lib/prompts/snippet.js
var require_snippet = __commonJS((exports, module) => {
  var stripAnsi = require_strip_ansi();
  var interpolate = require_interpolate();
  var Prompt = require_prompt();

  class SnippetPrompt extends Prompt {
    constructor(options) {
      super(options);
      this.cursorHide();
      this.reset(true);
    }
    async initialize() {
      this.interpolate = await interpolate(this);
      await super.initialize();
    }
    async reset(first) {
      this.state.keys = [];
      this.state.invalid = new Map;
      this.state.missing = new Set;
      this.state.completed = 0;
      this.state.values = {};
      if (first !== true) {
        await this.initialize();
        await this.render();
      }
    }
    moveCursor(n) {
      let item = this.getItem();
      this.cursor += n;
      item.cursor += n;
    }
    dispatch(ch, key) {
      if (!key.code && !key.ctrl && ch != null && this.getItem()) {
        this.append(ch, key);
        return;
      }
      this.alert();
    }
    append(ch, key) {
      let item = this.getItem();
      let prefix = item.input.slice(0, this.cursor);
      let suffix = item.input.slice(this.cursor);
      this.input = item.input = `${prefix}${ch}${suffix}`;
      this.moveCursor(1);
      this.render();
    }
    delete() {
      let item = this.getItem();
      if (this.cursor <= 0 || !item.input)
        return this.alert();
      let suffix = item.input.slice(this.cursor);
      let prefix = item.input.slice(0, this.cursor - 1);
      this.input = item.input = `${prefix}${suffix}`;
      this.moveCursor(-1);
      this.render();
    }
    increment(i) {
      return i >= this.state.keys.length - 1 ? 0 : i + 1;
    }
    decrement(i) {
      return i <= 0 ? this.state.keys.length - 1 : i - 1;
    }
    first() {
      this.state.index = 0;
      this.render();
    }
    last() {
      this.state.index = this.state.keys.length - 1;
      this.render();
    }
    right() {
      if (this.cursor >= this.input.length)
        return this.alert();
      this.moveCursor(1);
      this.render();
    }
    left() {
      if (this.cursor <= 0)
        return this.alert();
      this.moveCursor(-1);
      this.render();
    }
    prev() {
      this.state.index = this.decrement(this.state.index);
      this.getItem();
      this.render();
    }
    next() {
      this.state.index = this.increment(this.state.index);
      this.getItem();
      this.render();
    }
    up() {
      this.prev();
    }
    down() {
      this.next();
    }
    format(value) {
      let color = this.state.completed < 100 ? this.styles.warning : this.styles.success;
      if (this.state.submitted === true && this.state.completed !== 100) {
        color = this.styles.danger;
      }
      return color(`${this.state.completed}% completed`);
    }
    async render() {
      let { index, keys = [], submitted, size } = this.state;
      let newline = [this.options.newline, `
`].find((v) => v != null);
      let prefix = await this.prefix();
      let separator = await this.separator();
      let message = await this.message();
      let prompt = [prefix, message, separator].filter(Boolean).join(" ");
      this.state.prompt = prompt;
      let header = await this.header();
      let error = await this.error() || "";
      let hint = await this.hint() || "";
      let body = submitted ? "" : await this.interpolate(this.state);
      let key = this.state.key = keys[index] || "";
      let input = await this.format(key);
      let footer = await this.footer();
      if (input)
        prompt += " " + input;
      if (hint && !input && this.state.completed === 0)
        prompt += " " + hint;
      this.clear(size);
      let lines = [header, prompt, body, footer, error.trim()];
      this.write(lines.filter(Boolean).join(newline));
      this.restore();
    }
    getItem(name) {
      let { items, keys, index } = this.state;
      let item = items.find((ch) => ch.name === keys[index]);
      if (item && item.input != null) {
        this.input = item.input;
        this.cursor = item.cursor;
      }
      return item;
    }
    async submit() {
      if (typeof this.interpolate !== "function")
        await this.initialize();
      await this.interpolate(this.state, true);
      let { invalid, missing, output, values } = this.state;
      if (invalid.size) {
        let err = "";
        for (let [key, value] of invalid)
          err += `Invalid ${key}: ${value}
`;
        this.state.error = err;
        return super.submit();
      }
      if (missing.size) {
        this.state.error = "Required: " + [...missing.keys()].join(", ");
        return super.submit();
      }
      let lines = stripAnsi(output).split(`
`);
      let result = lines.map((v) => v.slice(1)).join(`
`);
      this.value = { values, result };
      return super.submit();
    }
  }
  module.exports = SnippetPrompt;
});

// node_modules/enquirer/lib/prompts/sort.js
var require_sort = __commonJS((exports, module) => {
  var hint = "(Use <shift>+<up/down> to sort)";
  var Prompt = require_select();

  class Sort extends Prompt {
    constructor(options) {
      super({ ...options, reorder: false, sort: true, multiple: true });
      this.state.hint = [this.options.hint, hint].find(this.isValue.bind(this));
    }
    indicator() {
      return "";
    }
    async renderChoice(choice, i) {
      let str = await super.renderChoice(choice, i);
      let sym = this.symbols.identicalTo + " ";
      let pre = this.index === i && this.sorting ? this.styles.muted(sym) : "  ";
      if (this.options.drag === false)
        pre = "";
      if (this.options.numbered === true) {
        return pre + `${i + 1} - ` + str;
      }
      return pre + str;
    }
    get selected() {
      return this.choices;
    }
    submit() {
      this.value = this.choices.map((choice) => choice.value);
      return super.submit();
    }
  }
  module.exports = Sort;
});

// node_modules/enquirer/lib/prompts/survey.js
var require_survey = __commonJS((exports, module) => {
  var ArrayPrompt = require_array();

  class Survey extends ArrayPrompt {
    constructor(options = {}) {
      super(options);
      this.emptyError = options.emptyError || "No items were selected";
      this.term = process.env.TERM_PROGRAM;
      if (!this.options.header) {
        let header = ["", "4 - Strongly Agree", "3 - Agree", "2 - Neutral", "1 - Disagree", "0 - Strongly Disagree", ""];
        header = header.map((ele) => this.styles.muted(ele));
        this.state.header = header.join(`
   `);
      }
    }
    async toChoices(...args) {
      if (this.createdScales)
        return false;
      this.createdScales = true;
      let choices = await super.toChoices(...args);
      for (let choice of choices) {
        choice.scale = createScale(5, this.options);
        choice.scaleIdx = 2;
      }
      return choices;
    }
    dispatch() {
      this.alert();
    }
    space() {
      let choice = this.focused;
      let ele = choice.scale[choice.scaleIdx];
      let selected = ele.selected;
      choice.scale.forEach((e) => e.selected = false);
      ele.selected = !selected;
      return this.render();
    }
    indicator() {
      return "";
    }
    pointer() {
      return "";
    }
    separator() {
      return this.styles.muted(this.symbols.ellipsis);
    }
    right() {
      let choice = this.focused;
      if (choice.scaleIdx >= choice.scale.length - 1)
        return this.alert();
      choice.scaleIdx++;
      return this.render();
    }
    left() {
      let choice = this.focused;
      if (choice.scaleIdx <= 0)
        return this.alert();
      choice.scaleIdx--;
      return this.render();
    }
    indent() {
      return "   ";
    }
    async renderChoice(item, i) {
      await this.onChoice(item, i);
      let focused = this.index === i;
      let isHyper = this.term === "Hyper";
      let n = !isHyper ? 8 : 9;
      let s = !isHyper ? " " : "";
      let ln = this.symbols.line.repeat(n);
      let sp = " ".repeat(n + (isHyper ? 0 : 1));
      let dot = (enabled) => (enabled ? this.styles.success("◉") : "◯") + s;
      let num = i + 1 + ".";
      let color = focused ? this.styles.heading : this.styles.noop;
      let msg = await this.resolve(item.message, this.state, item, i);
      let indent = this.indent(item);
      let scale = indent + item.scale.map((e, i2) => dot(i2 === item.scaleIdx)).join(ln);
      let val = (i2) => i2 === item.scaleIdx ? color(i2) : i2;
      let next = indent + item.scale.map((e, i2) => val(i2)).join(sp);
      let line = () => [num, msg].filter(Boolean).join(" ");
      let lines = () => [line(), scale, next, " "].filter(Boolean).join(`
`);
      if (focused) {
        scale = this.styles.cyan(scale);
        next = this.styles.cyan(next);
      }
      return lines();
    }
    async renderChoices() {
      if (this.state.submitted)
        return "";
      let choices = this.visible.map(async (ch, i) => await this.renderChoice(ch, i));
      let visible = await Promise.all(choices);
      if (!visible.length)
        visible.push(this.styles.danger("No matching choices"));
      return visible.join(`
`);
    }
    format() {
      if (this.state.submitted) {
        let values = this.choices.map((ch) => this.styles.info(ch.scaleIdx));
        return values.join(", ");
      }
      return "";
    }
    async render() {
      let { submitted, size } = this.state;
      let prefix = await this.prefix();
      let separator = await this.separator();
      let message = await this.message();
      let prompt = [prefix, message, separator].filter(Boolean).join(" ");
      this.state.prompt = prompt;
      let header = await this.header();
      let output = await this.format();
      let help = await this.error() || await this.hint();
      let body = await this.renderChoices();
      let footer = await this.footer();
      if (output || !help)
        prompt += " " + output;
      if (help && !prompt.includes(help))
        prompt += " " + help;
      if (submitted && !output && !body && this.multiple && this.type !== "form") {
        prompt += this.styles.danger(this.emptyError);
      }
      this.clear(size);
      this.write([prompt, header, body, footer].filter(Boolean).join(`
`));
      this.restore();
    }
    submit() {
      this.value = {};
      for (let choice of this.choices) {
        this.value[choice.name] = choice.scaleIdx;
      }
      return this.base.submit.call(this);
    }
  }
  function createScale(n, options = {}) {
    if (Array.isArray(options.scale)) {
      return options.scale.map((ele) => ({ ...ele }));
    }
    let scale = [];
    for (let i = 1;i < n + 1; i++)
      scale.push({ i, selected: false });
    return scale;
  }
  module.exports = Survey;
});

// node_modules/enquirer/lib/prompts/toggle.js
var require_toggle = __commonJS((exports, module) => {
  var BooleanPrompt = require_boolean();

  class TogglePrompt extends BooleanPrompt {
    async initialize() {
      await super.initialize();
      this.value = this.initial = this.resolve(this.options.initial);
      this.disabled = this.options.disabled || "no";
      this.enabled = this.options.enabled || "yes";
      await this.render();
    }
    reset() {
      this.value = this.initial;
      this.render();
    }
    delete() {
      this.alert();
    }
    toggle() {
      this.value = !this.value;
      this.render();
    }
    enable() {
      if (this.value === true)
        return this.alert();
      this.value = true;
      this.render();
    }
    disable() {
      if (this.value === false)
        return this.alert();
      this.value = false;
      this.render();
    }
    up() {
      this.toggle();
    }
    down() {
      this.toggle();
    }
    right() {
      this.toggle();
    }
    left() {
      this.toggle();
    }
    next() {
      this.toggle();
    }
    prev() {
      this.toggle();
    }
    dispatch(ch = "", key) {
      switch (ch.toLowerCase()) {
        case " ":
          return this.toggle();
        case "1":
        case "y":
        case "t":
          return this.enable();
        case "0":
        case "n":
        case "f":
          return this.disable();
        default: {
          return this.alert();
        }
      }
    }
    format() {
      let active = (str) => this.styles.primary.underline(str);
      let value = [
        this.value ? this.disabled : active(this.disabled),
        this.value ? active(this.enabled) : this.enabled
      ];
      return value.join(this.styles.muted(" / "));
    }
    async render() {
      let { size } = this.state;
      let header = await this.header();
      let prefix = await this.prefix();
      let separator = await this.separator();
      let message = await this.message();
      let output = await this.format();
      let help = await this.error() || await this.hint();
      let footer = await this.footer();
      let prompt = [prefix, message, separator, output].join(" ");
      this.state.prompt = prompt;
      if (help && !prompt.includes(help))
        prompt += " " + help;
      this.clear(size);
      this.write([header, prompt, footer].filter(Boolean).join(`
`));
      this.write(this.margin[2]);
      this.restore();
    }
  }
  module.exports = TogglePrompt;
});

// node_modules/enquirer/lib/prompts/quiz.js
var require_quiz = __commonJS((exports, module) => {
  var SelectPrompt = require_select();

  class Quiz extends SelectPrompt {
    constructor(options) {
      super(options);
      if (typeof this.options.correctChoice !== "number" || this.options.correctChoice < 0) {
        throw new Error("Please specify the index of the correct answer from the list of choices");
      }
    }
    async toChoices(value, parent) {
      let choices = await super.toChoices(value, parent);
      if (choices.length < 2) {
        throw new Error("Please give at least two choices to the user");
      }
      if (this.options.correctChoice > choices.length) {
        throw new Error("Please specify the index of the correct answer from the list of choices");
      }
      return choices;
    }
    check(state) {
      return state.index === this.options.correctChoice;
    }
    async result(selected) {
      return {
        selectedAnswer: selected,
        correctAnswer: this.options.choices[this.options.correctChoice].value,
        correct: await this.check(this.state)
      };
    }
  }
  module.exports = Quiz;
});

// node_modules/enquirer/lib/prompts/index.js
var require_prompts = __commonJS((exports) => {
  var utils = require_utils();
  var define = (key, fn) => {
    utils.defineExport(exports, key, fn);
    utils.defineExport(exports, key.toLowerCase(), fn);
  };
  define("AutoComplete", () => require_autocomplete());
  define("BasicAuth", () => require_basicauth());
  define("Confirm", () => require_confirm());
  define("Editable", () => require_editable());
  define("Form", () => require_form());
  define("Input", () => require_input());
  define("Invisible", () => require_invisible());
  define("List", () => require_list());
  define("MultiSelect", () => require_multiselect());
  define("Numeral", () => require_number());
  define("Password", () => require_password());
  define("Scale", () => require_scale());
  define("Select", () => require_select());
  define("Snippet", () => require_snippet());
  define("Sort", () => require_sort());
  define("Survey", () => require_survey());
  define("Text", () => require_input());
  define("Toggle", () => require_toggle());
  define("Quiz", () => require_quiz());
});

// node_modules/enquirer/lib/types/index.js
var require_types = __commonJS((exports, module) => {
  module.exports = {
    ArrayPrompt: require_array(),
    AuthPrompt: require_auth(),
    BooleanPrompt: require_boolean(),
    NumberPrompt: require_number(),
    StringPrompt: require_string2()
  };
});

// node_modules/enquirer/index.js
var require_enquirer = __commonJS((exports, module) => {
  var assert = __require("assert");
  var Events = __require("events");
  var utils = require_utils();

  class Enquirer extends Events {
    constructor(options, answers) {
      super();
      this.options = utils.merge({}, options);
      this.answers = { ...answers };
    }
    register(type, fn) {
      if (utils.isObject(type)) {
        for (let key of Object.keys(type))
          this.register(key, type[key]);
        return this;
      }
      assert.equal(typeof fn, "function", "expected a function");
      const name = type.toLowerCase();
      if (fn.prototype instanceof this.Prompt) {
        this.prompts[name] = fn;
      } else {
        this.prompts[name] = fn(this.Prompt, this);
      }
      return this;
    }
    async prompt(questions = []) {
      for (let question of [].concat(questions)) {
        try {
          if (typeof question === "function")
            question = await question.call(this);
          await this.ask(utils.merge({}, this.options, question));
        } catch (err) {
          return Promise.reject(err);
        }
      }
      return this.answers;
    }
    async ask(question) {
      if (typeof question === "function") {
        question = await question.call(this);
      }
      let opts = utils.merge({}, this.options, question);
      let { type, name } = question;
      let { set, get } = utils;
      if (typeof type === "function") {
        type = await type.call(this, question, this.answers);
      }
      if (!type)
        return this.answers[name];
      if (type === "number")
        type = "numeral";
      assert(this.prompts[type], `Prompt "${type}" is not registered`);
      let prompt = new this.prompts[type](opts);
      let value = get(this.answers, name);
      prompt.state.answers = this.answers;
      prompt.enquirer = this;
      if (name) {
        prompt.on("submit", (value2) => {
          this.emit("answer", name, value2, prompt);
          set(this.answers, name, value2);
        });
      }
      let emit = prompt.emit.bind(prompt);
      prompt.emit = (...args) => {
        this.emit.call(this, ...args);
        return emit(...args);
      };
      this.emit("prompt", prompt, this);
      if (opts.autofill && value != null) {
        prompt.value = prompt.input = value;
        if (opts.autofill === "show") {
          await prompt.submit();
        }
      } else {
        value = prompt.value = await prompt.run();
      }
      return value;
    }
    use(plugin) {
      plugin.call(this, this);
      return this;
    }
    set Prompt(value) {
      this._Prompt = value;
    }
    get Prompt() {
      return this._Prompt || this.constructor.Prompt;
    }
    get prompts() {
      return this.constructor.prompts;
    }
    static set Prompt(value) {
      this._Prompt = value;
    }
    static get Prompt() {
      return this._Prompt || require_prompt();
    }
    static get prompts() {
      return require_prompts();
    }
    static get types() {
      return require_types();
    }
    static get prompt() {
      const fn = (questions, ...rest) => {
        let enquirer = new this(...rest);
        let emit = enquirer.emit.bind(enquirer);
        enquirer.emit = (...args) => {
          fn.emit(...args);
          return emit(...args);
        };
        return enquirer.prompt(questions);
      };
      utils.mixinEmitter(fn, new Events);
      return fn;
    }
  }
  utils.mixinEmitter(Enquirer, new Events);
  var prompts = Enquirer.prompts;
  for (let name of Object.keys(prompts)) {
    let key = name.toLowerCase();
    let run = (options) => new prompts[name](options).run();
    Enquirer.prompt[key] = run;
    Enquirer[key] = run;
    if (!Enquirer[name]) {
      Reflect.defineProperty(Enquirer, name, { get: () => prompts[name] });
    }
  }
  var define = (name) => {
    utils.defineExport(Enquirer, name, () => Enquirer.types[name]);
  };
  define("ArrayPrompt");
  define("AuthPrompt");
  define("BooleanPrompt");
  define("NumberPrompt");
  define("StringPrompt");
  module.exports = Enquirer;
});

// node_modules/js-yaml/dist/js-yaml.mjs
var exports_js_yaml = {};
__export(exports_js_yaml, {
  types: () => types,
  safeLoadAll: () => safeLoadAll,
  safeLoad: () => safeLoad,
  safeDump: () => safeDump,
  loadAll: () => loadAll,
  load: () => load,
  dump: () => dump,
  default: () => jsYaml,
  YAMLException: () => YAMLException,
  Type: () => Type,
  Schema: () => Schema,
  JSON_SCHEMA: () => JSON_SCHEMA,
  FAILSAFE_SCHEMA: () => FAILSAFE_SCHEMA,
  DEFAULT_SCHEMA: () => DEFAULT_SCHEMA,
  CORE_SCHEMA: () => CORE_SCHEMA
});
function isNothing(subject) {
  return typeof subject === "undefined" || subject === null;
}
function isObject(subject) {
  return typeof subject === "object" && subject !== null;
}
function toArray(sequence) {
  if (Array.isArray(sequence))
    return sequence;
  else if (isNothing(sequence))
    return [];
  return [sequence];
}
function extend(target, source) {
  var index, length, key, sourceKeys;
  if (source) {
    sourceKeys = Object.keys(source);
    for (index = 0, length = sourceKeys.length;index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }
  return target;
}
function repeat(string, count) {
  var result = "", cycle;
  for (cycle = 0;cycle < count; cycle += 1) {
    result += string;
  }
  return result;
}
function isNegativeZero(number) {
  return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
}
function formatError(exception, compact) {
  var where = "", message = exception.reason || "(unknown reason)";
  if (!exception.mark)
    return message;
  if (exception.mark.name) {
    where += 'in "' + exception.mark.name + '" ';
  }
  where += "(" + (exception.mark.line + 1) + ":" + (exception.mark.column + 1) + ")";
  if (!compact && exception.mark.snippet) {
    where += `

` + exception.mark.snippet;
  }
  return message + " " + where;
}
function YAMLException$1(reason, mark) {
  Error.call(this);
  this.name = "YAMLException";
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = new Error().stack || "";
  }
}
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = "";
  var tail = "";
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
    pos: position - lineStart + head.length
  };
}
function padStart(string, max) {
  return common.repeat(" ", max - string.length) + string;
}
function makeSnippet(mark, options) {
  options = Object.create(options || null);
  if (!mark.buffer)
    return null;
  if (!options.maxLength)
    options.maxLength = 79;
  if (typeof options.indent !== "number")
    options.indent = 1;
  if (typeof options.linesBefore !== "number")
    options.linesBefore = 3;
  if (typeof options.linesAfter !== "number")
    options.linesAfter = 2;
  var re = /\r?\n|\r|\0/g;
  var lineStarts = [0];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;
  while (match = re.exec(mark.buffer)) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);
    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }
  if (foundLineNo < 0)
    foundLineNo = lineStarts.length - 1;
  var result = "", i, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
  for (i = 1;i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0)
      break;
    line = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
    result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + `
` + result;
  }
  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + `
`;
  result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^" + `
`;
  for (i = 1;i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length)
      break;
    line = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
    result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + `
`;
  }
  return result.replace(/\n$/, "");
}
function compileStyleAliases(map) {
  var result = {};
  if (map !== null) {
    Object.keys(map).forEach(function(style) {
      map[style].forEach(function(alias) {
        result[String(alias)] = style;
      });
    });
  }
  return result;
}
function Type$1(tag, options) {
  options = options || {};
  Object.keys(options).forEach(function(name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });
  this.options = options;
  this.tag = tag;
  this.kind = options["kind"] || null;
  this.resolve = options["resolve"] || function() {
    return true;
  };
  this.construct = options["construct"] || function(data) {
    return data;
  };
  this.instanceOf = options["instanceOf"] || null;
  this.predicate = options["predicate"] || null;
  this.represent = options["represent"] || null;
  this.representName = options["representName"] || null;
  this.defaultStyle = options["defaultStyle"] || null;
  this.multi = options["multi"] || false;
  this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}
function compileList(schema, name) {
  var result = [];
  schema[name].forEach(function(currentType) {
    var newIndex = result.length;
    result.forEach(function(previousType, previousIndex) {
      if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
        newIndex = previousIndex;
      }
    });
    result[newIndex] = currentType;
  });
  return result;
}
function compileMap() {
  var result = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, index, length;
  function collectType(type2) {
    if (type2.multi) {
      result.multi[type2.kind].push(type2);
      result.multi["fallback"].push(type2);
    } else {
      result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
    }
  }
  for (index = 0, length = arguments.length;index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}
function Schema$1(definition) {
  return this.extend(definition);
}
function resolveYamlNull(data) {
  if (data === null)
    return true;
  var max = data.length;
  return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
}
function constructYamlNull() {
  return null;
}
function isNull(object) {
  return object === null;
}
function resolveYamlBoolean(data) {
  if (data === null)
    return false;
  var max = data.length;
  return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
}
function constructYamlBoolean(data) {
  return data === "true" || data === "True" || data === "TRUE";
}
function isBoolean(object) {
  return Object.prototype.toString.call(object) === "[object Boolean]";
}
function isHexCode(c) {
  return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
}
function isOctCode(c) {
  return 48 <= c && c <= 55;
}
function isDecCode(c) {
  return 48 <= c && c <= 57;
}
function resolveYamlInteger(data) {
  if (data === null)
    return false;
  var max = data.length, index = 0, hasDigits = false, ch;
  if (!max)
    return false;
  ch = data[index];
  if (ch === "-" || ch === "+") {
    ch = data[++index];
  }
  if (ch === "0") {
    if (index + 1 === max)
      return true;
    ch = data[++index];
    if (ch === "b") {
      index++;
      for (;index < max; index++) {
        ch = data[index];
        if (ch === "_")
          continue;
        if (ch !== "0" && ch !== "1")
          return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "x") {
      index++;
      for (;index < max; index++) {
        ch = data[index];
        if (ch === "_")
          continue;
        if (!isHexCode(data.charCodeAt(index)))
          return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "o") {
      index++;
      for (;index < max; index++) {
        ch = data[index];
        if (ch === "_")
          continue;
        if (!isOctCode(data.charCodeAt(index)))
          return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
  }
  if (ch === "_")
    return false;
  for (;index < max; index++) {
    ch = data[index];
    if (ch === "_")
      continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }
  if (!hasDigits || ch === "_")
    return false;
  return true;
}
function constructYamlInteger(data) {
  var value = data, sign = 1, ch;
  if (value.indexOf("_") !== -1) {
    value = value.replace(/_/g, "");
  }
  ch = value[0];
  if (ch === "-" || ch === "+") {
    if (ch === "-")
      sign = -1;
    value = value.slice(1);
    ch = value[0];
  }
  if (value === "0")
    return 0;
  if (ch === "0") {
    if (value[1] === "b")
      return sign * parseInt(value.slice(2), 2);
    if (value[1] === "x")
      return sign * parseInt(value.slice(2), 16);
    if (value[1] === "o")
      return sign * parseInt(value.slice(2), 8);
  }
  return sign * parseInt(value, 10);
}
function isInteger(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
}
function resolveYamlFloat(data) {
  if (data === null)
    return false;
  if (!YAML_FLOAT_PATTERN.test(data) || data[data.length - 1] === "_") {
    return false;
  }
  return true;
}
function constructYamlFloat(data) {
  var value, sign;
  value = data.replace(/_/g, "").toLowerCase();
  sign = value[0] === "-" ? -1 : 1;
  if ("+-".indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }
  if (value === ".inf") {
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  } else if (value === ".nan") {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}
function representYamlFloat(object, style) {
  var res;
  if (isNaN(object)) {
    switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  } else if (common.isNegativeZero(object)) {
    return "-0.0";
  }
  res = object.toString(10);
  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
}
function isFloat(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
}
function resolveYamlTimestamp(data) {
  if (data === null)
    return false;
  if (YAML_DATE_REGEXP.exec(data) !== null)
    return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null)
    return true;
  return false;
}
function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
  match = YAML_DATE_REGEXP.exec(data);
  if (match === null)
    match = YAML_TIMESTAMP_REGEXP.exec(data);
  if (match === null)
    throw new Error("Date resolve error");
  year = +match[1];
  month = +match[2] - 1;
  day = +match[3];
  if (!match[4]) {
    return new Date(Date.UTC(year, month, day));
  }
  hour = +match[4];
  minute = +match[5];
  second = +match[6];
  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) {
      fraction += "0";
    }
    fraction = +fraction;
  }
  if (match[9]) {
    tz_hour = +match[10];
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 60000;
    if (match[9] === "-")
      delta = -delta;
  }
  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  if (delta)
    date.setTime(date.getTime() - delta);
  return date;
}
function representYamlTimestamp(object) {
  return object.toISOString();
}
function resolveYamlMerge(data) {
  return data === "<<" || data === null;
}
function resolveYamlBinary(data) {
  if (data === null)
    return false;
  var code, idx, bitlen = 0, max = data.length, map2 = BASE64_MAP;
  for (idx = 0;idx < max; idx++) {
    code = map2.indexOf(data.charAt(idx));
    if (code > 64)
      continue;
    if (code < 0)
      return false;
    bitlen += 6;
  }
  return bitlen % 8 === 0;
}
function constructYamlBinary(data) {
  var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result = [];
  for (idx = 0;idx < max; idx++) {
    if (idx % 4 === 0 && idx) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    }
    bits = bits << 6 | map2.indexOf(input.charAt(idx));
  }
  tailbits = max % 4 * 6;
  if (tailbits === 0) {
    result.push(bits >> 16 & 255);
    result.push(bits >> 8 & 255);
    result.push(bits & 255);
  } else if (tailbits === 18) {
    result.push(bits >> 10 & 255);
    result.push(bits >> 2 & 255);
  } else if (tailbits === 12) {
    result.push(bits >> 4 & 255);
  }
  return new Uint8Array(result);
}
function representYamlBinary(object) {
  var result = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
  for (idx = 0;idx < max; idx++) {
    if (idx % 3 === 0 && idx) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    }
    bits = (bits << 8) + object[idx];
  }
  tail = max % 3;
  if (tail === 0) {
    result += map2[bits >> 18 & 63];
    result += map2[bits >> 12 & 63];
    result += map2[bits >> 6 & 63];
    result += map2[bits & 63];
  } else if (tail === 2) {
    result += map2[bits >> 10 & 63];
    result += map2[bits >> 4 & 63];
    result += map2[bits << 2 & 63];
    result += map2[64];
  } else if (tail === 1) {
    result += map2[bits >> 2 & 63];
    result += map2[bits << 4 & 63];
    result += map2[64];
    result += map2[64];
  }
  return result;
}
function isBinary(obj) {
  return Object.prototype.toString.call(obj) === "[object Uint8Array]";
}
function resolveYamlOmap(data) {
  if (data === null)
    return true;
  var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
  for (index = 0, length = object.length;index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;
    if (_toString$2.call(pair) !== "[object Object]")
      return false;
    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey)
          pairHasKey = true;
        else
          return false;
      }
    }
    if (!pairHasKey)
      return false;
    if (objectKeys.indexOf(pairKey) === -1)
      objectKeys.push(pairKey);
    else
      return false;
  }
  return true;
}
function constructYamlOmap(data) {
  return data !== null ? data : [];
}
function resolveYamlPairs(data) {
  if (data === null)
    return true;
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length;index < length; index += 1) {
    pair = object[index];
    if (_toString$1.call(pair) !== "[object Object]")
      return false;
    keys = Object.keys(pair);
    if (keys.length !== 1)
      return false;
    result[index] = [keys[0], pair[keys[0]]];
  }
  return true;
}
function constructYamlPairs(data) {
  if (data === null)
    return [];
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length;index < length; index += 1) {
    pair = object[index];
    keys = Object.keys(pair);
    result[index] = [keys[0], pair[keys[0]]];
  }
  return result;
}
function resolveYamlSet(data) {
  if (data === null)
    return true;
  var key, object = data;
  for (key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null)
        return false;
    }
  }
  return true;
}
function constructYamlSet(data) {
  return data !== null ? data : {};
}
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function is_EOL(c) {
  return c === 10 || c === 13;
}
function is_WHITE_SPACE(c) {
  return c === 9 || c === 32;
}
function is_WS_OR_EOL(c) {
  return c === 9 || c === 32 || c === 10 || c === 13;
}
function is_FLOW_INDICATOR(c) {
  return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
}
function fromHexCode(c) {
  var lc;
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  lc = c | 32;
  if (97 <= lc && lc <= 102) {
    return lc - 97 + 10;
  }
  return -1;
}
function escapedHexLen(c) {
  if (c === 120) {
    return 2;
  }
  if (c === 117) {
    return 4;
  }
  if (c === 85) {
    return 8;
  }
  return 0;
}
function fromDecimalCode(c) {
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  return -1;
}
function simpleEscapeSequence(c) {
  return c === 48 ? "\x00" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "\t" : c === 9 ? "\t" : c === 110 ? `
` : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "" : c === 95 ? " " : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
}
function charFromCodepoint(c) {
  if (c <= 65535) {
    return String.fromCharCode(c);
  }
  return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
}
function setProperty(object, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
  } else {
    object[key] = value;
  }
}
function State$1(input, options) {
  this.input = input;
  this.filename = options["filename"] || null;
  this.schema = options["schema"] || _default;
  this.onWarning = options["onWarning"] || null;
  this.legacy = options["legacy"] || false;
  this.json = options["json"] || false;
  this.listener = options["listener"] || null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap = this.schema.compiledTypeMap;
  this.length = input.length;
  this.position = 0;
  this.line = 0;
  this.lineStart = 0;
  this.lineIndent = 0;
  this.firstTabInLine = -1;
  this.documents = [];
}
function generateError(state, message) {
  var mark = {
    name: state.filename,
    buffer: state.input.slice(0, -1),
    position: state.position,
    line: state.line,
    column: state.position - state.lineStart
  };
  mark.snippet = snippet(mark);
  return new exception(message, mark);
}
function throwError(state, message) {
  throw generateError(state, message);
}
function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}
function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;
  if (start < end) {
    _result = state.input.slice(start, end);
    if (checkJson) {
      for (_position = 0, _length = _result.length;_position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
          throwError(state, "expected valid JSON character");
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, "the stream contains non-printable characters");
    }
    state.result += _result;
  }
}
function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;
  if (!common.isObject(source)) {
    throwError(state, "cannot merge mappings; the provided source object is unacceptable");
  }
  sourceKeys = Object.keys(source);
  for (index = 0, quantity = sourceKeys.length;index < quantity; index += 1) {
    key = sourceKeys[index];
    if (!_hasOwnProperty$1.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}
function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
  var index, quantity;
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);
    for (index = 0, quantity = keyNode.length;index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, "nested arrays are not supported inside keys");
      }
      if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
        keyNode[index] = "[object Object]";
      }
    }
  }
  if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
    keyNode = "[object Object]";
  }
  keyNode = String(keyNode);
  if (_result === null) {
    _result = {};
  }
  if (keyTag === "tag:yaml.org,2002:merge") {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length;index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json && !_hasOwnProperty$1.call(overridableKeys, keyNode) && _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, "duplicated mapping key");
    }
    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }
  return _result;
}
function readLineBreak(state) {
  var ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 10) {
    state.position++;
  } else if (ch === 13) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10) {
      state.position++;
    }
  } else {
    throwError(state, "a line break is expected");
  }
  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 9 && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 10 && ch !== 13 && ch !== 0);
    }
    if (is_EOL(ch)) {
      readLineBreak(state);
      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;
      while (ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }
  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, "deficient indentation");
  }
  return lineBreaks;
}
function testDocumentSeparator(state) {
  var _position = state.position, ch;
  ch = state.input.charCodeAt(_position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
    _position += 3;
    ch = state.input.charCodeAt(_position);
    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }
  return false;
}
function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += " ";
  } else if (count > 1) {
    state.result += common.repeat(`
`, count - 1);
  }
}
function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
  ch = state.input.charCodeAt(state.position);
  if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
    return false;
  }
  if (ch === 63 || ch === 45) {
    following = state.input.charCodeAt(state.position + 1);
    if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }
  state.kind = "scalar";
  state.result = "";
  captureStart = captureEnd = state.position;
  hasPendingContent = false;
  while (ch !== 0) {
    if (ch === 58) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }
    } else if (ch === 35) {
      preceding = state.input.charCodeAt(state.position - 1);
      if (is_WS_OR_EOL(preceding)) {
        break;
      }
    } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;
    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);
      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }
    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }
    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }
    ch = state.input.charCodeAt(++state.position);
  }
  captureSegment(state, captureStart, captureEnd, false);
  if (state.result) {
    return true;
  }
  state.kind = _kind;
  state.result = _result;
  return false;
}
function readSingleQuotedScalar(state, nodeIndent) {
  var ch, captureStart, captureEnd;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 39) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a single quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 34) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;
        for (;hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            throwError(state, "expected hexadecimal character");
          }
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else {
        throwError(state, "unknown escape sequence");
      }
      captureStart = captureEnd = state.position;
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a double quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readFlowCollection(state, nodeIndent) {
  var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = Object.create(null), keyNode, keyTag, valueNode, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 91) {
    terminator = 93;
    isMapping = false;
    _result = [];
  } else if (ch === 123) {
    terminator = 125;
    isMapping = true;
    _result = {};
  } else {
    return false;
  }
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(++state.position);
  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? "mapping" : "sequence";
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, "missed comma between flow collection entries");
    } else if (ch === 44) {
      throwError(state, "expected the node content, but found ','");
    }
    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;
    if (ch === 63) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }
    _line = state.line;
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if ((isExplicitPair || state.line === _line) && ch === 58) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }
    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === 44) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockScalar(state, nodeIndent) {
  var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 124) {
    folding = false;
  } else if (ch === 62) {
    folding = true;
  } else {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);
    if (ch === 43 || ch === 45) {
      if (CHOMPING_CLIP === chomping) {
        chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, "repeat of a chomping mode identifier");
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, "repeat of an indentation width identifier");
      }
    } else {
      break;
    }
  }
  if (is_WHITE_SPACE(ch)) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (is_WHITE_SPACE(ch));
    if (ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (!is_EOL(ch) && ch !== 0);
    }
  }
  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;
    ch = state.input.charCodeAt(state.position);
    while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }
    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }
    if (state.lineIndent < textIndent) {
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) {
          state.result += `
`;
        }
      }
      break;
    }
    if (folding) {
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat(`
`, emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) {
          state.result += " ";
        }
      } else {
        state.result += common.repeat(`
`, emptyLines);
      }
    } else {
      state.result += common.repeat(`
`, didReadContent ? 1 + emptyLines : emptyLines);
    }
    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;
    while (!is_EOL(ch) && ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, state.position, false);
  }
  return true;
}
function readBlockSequence(state, nodeIndent) {
  var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
  if (state.firstTabInLine !== -1)
    return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    if (ch !== 45) {
      break;
    }
    following = state.input.charCodeAt(state.position + 1);
    if (!is_WS_OR_EOL(following)) {
      break;
    }
    detected = true;
    state.position++;
    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }
    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a sequence entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "sequence";
    state.result = _result;
    return true;
  }
  return false;
}
function readBlockMapping(state, nodeIndent, flowIndent) {
  var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
  if (state.firstTabInLine !== -1)
    return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    following = state.input.charCodeAt(state.position + 1);
    _line = state.line;
    if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
      if (ch === 63) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        atExplicitKey = false;
        allowCompact = true;
      } else {
        throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
      }
      state.position += 1;
      ch = following;
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;
      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        break;
      }
      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!is_WS_OR_EOL(ch)) {
            throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          }
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          throwError(state, "can not read an implicit mapping pair; a colon is missed");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else if (detected) {
        throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true;
      }
    }
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }
      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }
      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a mapping entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "mapping";
    state.result = _result;
  }
  return detected;
}
function readTagProperty(state) {
  var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 33)
    return false;
  if (state.tag !== null) {
    throwError(state, "duplication of a tag property");
  }
  ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = "!";
  }
  _position = state.position;
  if (isVerbatim) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (ch !== 0 && ch !== 62);
    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, "unexpected end of the stream within a verbatim tag");
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      if (ch === 33) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, "named tag handle cannot contain such characters");
          }
          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, "tag suffix cannot contain exclamation marks");
        }
      }
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(_position, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, "tag suffix cannot contain flow indicator characters");
    }
  }
  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, "tag name cannot contain such characters: " + tagName);
  }
  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, "tag name is malformed: " + tagName);
  }
  if (isVerbatim) {
    state.tag = tagName;
  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === "!") {
    state.tag = "!" + tagName;
  } else if (tagHandle === "!!") {
    state.tag = "tag:yaml.org,2002:" + tagName;
  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }
  return true;
}
function readAnchorProperty(state) {
  var _position, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 38)
    return false;
  if (state.anchor !== null) {
    throwError(state, "duplication of an anchor property");
  }
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an anchor node must contain at least one character");
  }
  state.anchor = state.input.slice(_position, state.position);
  return true;
}
function readAlias(state) {
  var _position, alias, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 42)
    return false;
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an alias node must contain at least one character");
  }
  alias = state.input.slice(_position, state.position);
  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }
  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}
function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type2, flowIndent, blockIndent;
  if (state.listener !== null) {
    state.listener("open", state);
  }
  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;
  allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;
      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }
  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }
  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }
  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }
    blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) {
      if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) {
            throwError(state, "alias node should not have any properties");
          }
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) {
            state.tag = "?";
          }
        }
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }
  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }
  } else if (state.tag === "?") {
    if (state.result !== null && state.kind !== "scalar") {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }
    for (typeIndex = 0, typeQuantity = state.implicitTypes.length;typeIndex < typeQuantity; typeIndex += 1) {
      type2 = state.implicitTypes[typeIndex];
      if (type2.resolve(state.result)) {
        state.result = type2.construct(state.result);
        state.tag = type2.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== "!") {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || "fallback"], state.tag)) {
      type2 = state.typeMap[state.kind || "fallback"][state.tag];
    } else {
      type2 = null;
      typeList = state.typeMap.multi[state.kind || "fallback"];
      for (typeIndex = 0, typeQuantity = typeList.length;typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type2 = typeList[typeIndex];
          break;
        }
      }
    }
    if (!type2) {
      throwError(state, "unknown tag !<" + state.tag + ">");
    }
    if (state.result !== null && type2.kind !== state.kind) {
      throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
    }
    if (!type2.resolve(state.result, state.tag)) {
      throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
    } else {
      state.result = type2.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }
  if (state.listener !== null) {
    state.listener("close", state);
  }
  return state.tag !== null || state.anchor !== null || hasContent;
}
function readDocument(state) {
  var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = Object.create(null);
  state.anchorMap = Object.create(null);
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if (state.lineIndent > 0 || ch !== 37) {
      break;
    }
    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];
    if (directiveName.length < 1) {
      throwError(state, "directive name must not be less than one character in length");
    }
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && !is_EOL(ch));
        break;
      }
      if (is_EOL(ch))
        break;
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveArgs.push(state.input.slice(_position, state.position));
    }
    if (ch !== 0)
      readLineBreak(state);
    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }
  skipSeparationSpace(state, true, -1);
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    throwError(state, "directives end mark is expected");
  }
  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);
  if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, "non-ASCII line breaks are interpreted as content");
  }
  state.documents.push(state.result);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === 46) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }
  if (state.position < state.length - 1) {
    throwError(state, "end of the stream or a document separator is expected");
  } else {
    return;
  }
}
function loadDocuments(input, options) {
  input = String(input);
  options = options || {};
  if (input.length !== 0) {
    if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
      input += `
`;
    }
    if (input.charCodeAt(0) === 65279) {
      input = input.slice(1);
    }
  }
  var state = new State$1(input, options);
  var nullpos = input.indexOf("\x00");
  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, "null byte is not allowed in input");
  }
  state.input += "\x00";
  while (state.input.charCodeAt(state.position) === 32) {
    state.lineIndent += 1;
    state.position += 1;
  }
  while (state.position < state.length - 1) {
    readDocument(state);
  }
  return state.documents;
}
function loadAll$1(input, iterator, options) {
  if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
    options = iterator;
    iterator = null;
  }
  var documents = loadDocuments(input, options);
  if (typeof iterator !== "function") {
    return documents;
  }
  for (var index = 0, length = documents.length;index < length; index += 1) {
    iterator(documents[index]);
  }
}
function load$1(input, options) {
  var documents = loadDocuments(input, options);
  if (documents.length === 0) {
    return;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception("expected a single document in the stream, but found more");
}
function compileStyleMap(schema2, map2) {
  var result, keys, index, length, tag, style, type2;
  if (map2 === null)
    return {};
  result = {};
  keys = Object.keys(map2);
  for (index = 0, length = keys.length;index < length; index += 1) {
    tag = keys[index];
    style = String(map2[tag]);
    if (tag.slice(0, 2) === "!!") {
      tag = "tag:yaml.org,2002:" + tag.slice(2);
    }
    type2 = schema2.compiledTypeMap["fallback"][tag];
    if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
      style = type2.styleAliases[style];
    }
    result[tag] = style;
  }
  return result;
}
function encodeHex(character) {
  var string, handle, length;
  string = character.toString(16).toUpperCase();
  if (character <= 255) {
    handle = "x";
    length = 2;
  } else if (character <= 65535) {
    handle = "u";
    length = 4;
  } else if (character <= 4294967295) {
    handle = "U";
    length = 8;
  } else {
    throw new exception("code point within a string may not be greater than 0xFFFFFFFF");
  }
  return "\\" + handle + common.repeat("0", length - string.length) + string;
}
function State(options) {
  this.schema = options["schema"] || _default;
  this.indent = Math.max(1, options["indent"] || 2);
  this.noArrayIndent = options["noArrayIndent"] || false;
  this.skipInvalid = options["skipInvalid"] || false;
  this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
  this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
  this.sortKeys = options["sortKeys"] || false;
  this.lineWidth = options["lineWidth"] || 80;
  this.noRefs = options["noRefs"] || false;
  this.noCompatMode = options["noCompatMode"] || false;
  this.condenseFlow = options["condenseFlow"] || false;
  this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes = options["forceQuotes"] || false;
  this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;
  this.tag = null;
  this.result = "";
  this.duplicates = [];
  this.usedDuplicates = null;
}
function indentString(string, spaces) {
  var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
  while (position < length) {
    next = string.indexOf(`
`, position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }
    if (line.length && line !== `
`)
      result += ind;
    result += line;
  }
  return result;
}
function generateNextLine(state, level) {
  return `
` + common.repeat(" ", state.indent * level);
}
function testImplicitResolving(state, str2) {
  var index, length, type2;
  for (index = 0, length = state.implicitTypes.length;index < length; index += 1) {
    type2 = state.implicitTypes[index];
    if (type2.resolve(str2)) {
      return true;
    }
  }
  return false;
}
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}
function isPrintable(c) {
  return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
}
function isNsCharOrWhitespace(c) {
  return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
}
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
}
function isPlainSafeFirst(c) {
  return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
}
function isPlainSafeLast(c) {
  return !isWhitespace(c) && c !== CHAR_COLON;
}
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 56320 && second <= 57343) {
      return (first - 55296) * 1024 + second - 56320 + 65536;
    }
  }
  return first;
}
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
  var i2;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false;
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1;
  var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
  if (singleLineOnly || forceQuotes) {
    for (i2 = 0;i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    for (i2 = 0;i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
      char = codePointAt(string, i2);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine || i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
          previousLineBreak = i2;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i2 - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
  }
  if (!hasLineBreak && !hasFoldableLine) {
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = function() {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
    }
    var indent = state.indent * Math.max(1, level);
    var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
    var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
    function testAmbiguity(string2) {
      return testImplicitResolving(state, string2);
    }
    switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception("impossible error: invalid scalar style");
    }
  }();
}
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
  var clip = string[string.length - 1] === `
`;
  var keep = clip && (string[string.length - 2] === `
` || string === `
`);
  var chomp = keep ? "+" : clip ? "" : "-";
  return indentIndicator + chomp + `
`;
}
function dropEndingNewline(string) {
  return string[string.length - 1] === `
` ? string.slice(0, -1) : string;
}
function foldString(string, width) {
  var lineRe = /(\n+)([^\n]*)/g;
  var result = function() {
    var nextLF = string.indexOf(`
`);
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  }();
  var prevMoreIndented = string[0] === `
` || string[0] === " ";
  var moreIndented;
  var match;
  while (match = lineRe.exec(string)) {
    var prefix = match[1], line = match[2];
    moreIndented = line[0] === " ";
    result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? `
` : "") + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }
  return result;
}
function foldLine(line, width) {
  if (line === "" || line[0] === " ")
    return line;
  var breakRe = / [^ ]/g;
  var match;
  var start = 0, end, curr = 0, next = 0;
  var result = "";
  while (match = breakRe.exec(line)) {
    next = match.index;
    if (next - start > width) {
      end = curr > start ? curr : next;
      result += `
` + line.slice(start, end);
      start = end + 1;
    }
    curr = next;
  }
  result += `
`;
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + `
` + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }
  return result.slice(1);
}
function escapeString(string) {
  var result = "";
  var char = 0;
  var escapeSeq;
  for (var i2 = 0;i2 < string.length; char >= 65536 ? i2 += 2 : i2++) {
    char = codePointAt(string, i2);
    escapeSeq = ESCAPE_SEQUENCES[char];
    if (!escapeSeq && isPrintable(char)) {
      result += string[i2];
      if (char >= 65536)
        result += string[i2 + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }
  return result;
}
function writeFlowSequence(state, level, object) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length;index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
      if (_result !== "")
        _result += "," + (!state.condenseFlow ? " " : "");
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = "[" + _result + "]";
}
function writeBlockSequence(state, level, object, compact) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length;index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
      if (!compact || _result !== "") {
        _result += generateNextLine(state, level);
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += "-";
      } else {
        _result += "- ";
      }
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = _result || "[]";
}
function writeFlowMapping(state, level, object) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
  for (index = 0, length = objectKeyList.length;index < length; index += 1) {
    pairBuffer = "";
    if (_result !== "")
      pairBuffer += ", ";
    if (state.condenseFlow)
      pairBuffer += '"';
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level, objectKey, false, false)) {
      continue;
    }
    if (state.dump.length > 1024)
      pairBuffer += "? ";
    pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
    if (!writeNode(state, level, objectValue, false, false)) {
      continue;
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = "{" + _result + "}";
}
function writeBlockMapping(state, level, object, compact) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
  if (state.sortKeys === true) {
    objectKeyList.sort();
  } else if (typeof state.sortKeys === "function") {
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    throw new exception("sortKeys must be a boolean or a function");
  }
  for (index = 0, length = objectKeyList.length;index < length; index += 1) {
    pairBuffer = "";
    if (!compact || _result !== "") {
      pairBuffer += generateNextLine(state, level);
    }
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue;
    }
    explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += "?";
      } else {
        pairBuffer += "? ";
      }
    }
    pairBuffer += state.dump;
    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }
    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue;
    }
    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ":";
    } else {
      pairBuffer += ": ";
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = _result || "{}";
}
function detectType(state, object, explicit) {
  var _result, typeList, index, length, type2, style;
  typeList = explicit ? state.explicitTypes : state.implicitTypes;
  for (index = 0, length = typeList.length;index < length; index += 1) {
    type2 = typeList[index];
    if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
      if (explicit) {
        if (type2.multi && type2.representName) {
          state.tag = type2.representName(object);
        } else {
          state.tag = type2.tag;
        }
      } else {
        state.tag = "?";
      }
      if (type2.represent) {
        style = state.styleMap[type2.tag] || type2.defaultStyle;
        if (_toString.call(type2.represent) === "[object Function]") {
          _result = type2.represent(object, style);
        } else if (_hasOwnProperty.call(type2.represent, style)) {
          _result = type2.represent[style](object, style);
        } else {
          throw new exception("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
        }
        state.dump = _result;
      }
      return true;
    }
  }
  return false;
}
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;
  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }
  var type2 = _toString.call(state.dump);
  var inblock = block;
  var tagStr;
  if (block) {
    block = state.flowLevel < 0 || state.flowLevel > level;
  }
  var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }
  if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
    compact = false;
  }
  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = "*ref_" + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type2 === "[object Object]") {
      if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object Array]") {
      if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object String]") {
      if (state.tag !== "?") {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type2 === "[object Undefined]") {
      return false;
    } else {
      if (state.skipInvalid)
        return false;
      throw new exception("unacceptable kind of an object to dump " + type2);
    }
    if (state.tag !== null && state.tag !== "?") {
      tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
      if (state.tag[0] === "!") {
        tagStr = "!" + tagStr;
      } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
        tagStr = "!!" + tagStr.slice(18);
      } else {
        tagStr = "!<" + tagStr + ">";
      }
      state.dump = tagStr + " " + state.dump;
    }
  }
  return true;
}
function getDuplicateReferences(object, state) {
  var objects = [], duplicatesIndexes = [], index, length;
  inspectNode(object, objects, duplicatesIndexes);
  for (index = 0, length = duplicatesIndexes.length;index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}
function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList, index, length;
  if (object !== null && typeof object === "object") {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);
      if (Array.isArray(object)) {
        for (index = 0, length = object.length;index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);
        for (index = 0, length = objectKeyList.length;index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}
function dump$1(input, options) {
  options = options || {};
  var state = new State(options);
  if (!state.noRefs)
    getDuplicateReferences(input, state);
  var value = input;
  if (state.replacer) {
    value = state.replacer.call({ "": value }, "", value);
  }
  if (writeNode(state, 0, value, true, true))
    return state.dump + `
`;
  return "";
}
function renamed(from, to) {
  return function() {
    throw new Error("Function yaml." + from + " is removed in js-yaml 4. " + "Use yaml." + to + " instead, which is now safe by default.");
  };
}
var isNothing_1, isObject_1, toArray_1, repeat_1, isNegativeZero_1, extend_1, common, exception, snippet, TYPE_CONSTRUCTOR_OPTIONS, YAML_NODE_KINDS, type, schema, str, seq, map, failsafe, _null, bool, int, YAML_FLOAT_PATTERN, SCIENTIFIC_WITHOUT_DOT, float, json, core, YAML_DATE_REGEXP, YAML_TIMESTAMP_REGEXP, timestamp, merge, BASE64_MAP = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`, binary, _hasOwnProperty$3, _toString$2, omap, _toString$1, pairs, _hasOwnProperty$2, set, _default, _hasOwnProperty$1, CONTEXT_FLOW_IN = 1, CONTEXT_FLOW_OUT = 2, CONTEXT_BLOCK_IN = 3, CONTEXT_BLOCK_OUT = 4, CHOMPING_CLIP = 1, CHOMPING_STRIP = 2, CHOMPING_KEEP = 3, PATTERN_NON_PRINTABLE, PATTERN_NON_ASCII_LINE_BREAKS, PATTERN_FLOW_INDICATORS, PATTERN_TAG_HANDLE, PATTERN_TAG_URI, simpleEscapeCheck, simpleEscapeMap, i, directiveHandlers, loadAll_1, load_1, loader, _toString, _hasOwnProperty, CHAR_BOM = 65279, CHAR_TAB = 9, CHAR_LINE_FEED = 10, CHAR_CARRIAGE_RETURN = 13, CHAR_SPACE = 32, CHAR_EXCLAMATION = 33, CHAR_DOUBLE_QUOTE = 34, CHAR_SHARP = 35, CHAR_PERCENT = 37, CHAR_AMPERSAND = 38, CHAR_SINGLE_QUOTE = 39, CHAR_ASTERISK = 42, CHAR_COMMA = 44, CHAR_MINUS = 45, CHAR_COLON = 58, CHAR_EQUALS = 61, CHAR_GREATER_THAN = 62, CHAR_QUESTION = 63, CHAR_COMMERCIAL_AT = 64, CHAR_LEFT_SQUARE_BRACKET = 91, CHAR_RIGHT_SQUARE_BRACKET = 93, CHAR_GRAVE_ACCENT = 96, CHAR_LEFT_CURLY_BRACKET = 123, CHAR_VERTICAL_LINE = 124, CHAR_RIGHT_CURLY_BRACKET = 125, ESCAPE_SEQUENCES, DEPRECATED_BOOLEANS_SYNTAX, DEPRECATED_BASE60_SYNTAX, QUOTING_TYPE_SINGLE = 1, QUOTING_TYPE_DOUBLE = 2, STYLE_PLAIN = 1, STYLE_SINGLE = 2, STYLE_LITERAL = 3, STYLE_FOLDED = 4, STYLE_DOUBLE = 5, dump_1, dumper, Type, Schema, FAILSAFE_SCHEMA, JSON_SCHEMA, CORE_SCHEMA, DEFAULT_SCHEMA, load, loadAll, dump, YAMLException, types, safeLoad, safeLoadAll, safeDump, jsYaml;
var init_js_yaml = __esm(() => {
  /*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT */
  isNothing_1 = isNothing;
  isObject_1 = isObject;
  toArray_1 = toArray;
  repeat_1 = repeat;
  isNegativeZero_1 = isNegativeZero;
  extend_1 = extend;
  common = {
    isNothing: isNothing_1,
    isObject: isObject_1,
    toArray: toArray_1,
    repeat: repeat_1,
    isNegativeZero: isNegativeZero_1,
    extend: extend_1
  };
  YAMLException$1.prototype = Object.create(Error.prototype);
  YAMLException$1.prototype.constructor = YAMLException$1;
  YAMLException$1.prototype.toString = function toString(compact) {
    return this.name + ": " + formatError(this, compact);
  };
  exception = YAMLException$1;
  snippet = makeSnippet;
  TYPE_CONSTRUCTOR_OPTIONS = [
    "kind",
    "multi",
    "resolve",
    "construct",
    "instanceOf",
    "predicate",
    "represent",
    "representName",
    "defaultStyle",
    "styleAliases"
  ];
  YAML_NODE_KINDS = [
    "scalar",
    "sequence",
    "mapping"
  ];
  type = Type$1;
  Schema$1.prototype.extend = function extend2(definition) {
    var implicit = [];
    var explicit = [];
    if (definition instanceof type) {
      explicit.push(definition);
    } else if (Array.isArray(definition)) {
      explicit = explicit.concat(definition);
    } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
      if (definition.implicit)
        implicit = implicit.concat(definition.implicit);
      if (definition.explicit)
        explicit = explicit.concat(definition.explicit);
    } else {
      throw new exception("Schema.extend argument should be a Type, [ Type ], " + "or a schema definition ({ implicit: [...], explicit: [...] })");
    }
    implicit.forEach(function(type$1) {
      if (!(type$1 instanceof type)) {
        throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
      if (type$1.loadKind && type$1.loadKind !== "scalar") {
        throw new exception("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
      }
      if (type$1.multi) {
        throw new exception("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
      }
    });
    explicit.forEach(function(type$1) {
      if (!(type$1 instanceof type)) {
        throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
      }
    });
    var result = Object.create(Schema$1.prototype);
    result.implicit = (this.implicit || []).concat(implicit);
    result.explicit = (this.explicit || []).concat(explicit);
    result.compiledImplicit = compileList(result, "implicit");
    result.compiledExplicit = compileList(result, "explicit");
    result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
    return result;
  };
  schema = Schema$1;
  str = new type("tag:yaml.org,2002:str", {
    kind: "scalar",
    construct: function(data) {
      return data !== null ? data : "";
    }
  });
  seq = new type("tag:yaml.org,2002:seq", {
    kind: "sequence",
    construct: function(data) {
      return data !== null ? data : [];
    }
  });
  map = new type("tag:yaml.org,2002:map", {
    kind: "mapping",
    construct: function(data) {
      return data !== null ? data : {};
    }
  });
  failsafe = new schema({
    explicit: [
      str,
      seq,
      map
    ]
  });
  _null = new type("tag:yaml.org,2002:null", {
    kind: "scalar",
    resolve: resolveYamlNull,
    construct: constructYamlNull,
    predicate: isNull,
    represent: {
      canonical: function() {
        return "~";
      },
      lowercase: function() {
        return "null";
      },
      uppercase: function() {
        return "NULL";
      },
      camelcase: function() {
        return "Null";
      },
      empty: function() {
        return "";
      }
    },
    defaultStyle: "lowercase"
  });
  bool = new type("tag:yaml.org,2002:bool", {
    kind: "scalar",
    resolve: resolveYamlBoolean,
    construct: constructYamlBoolean,
    predicate: isBoolean,
    represent: {
      lowercase: function(object) {
        return object ? "true" : "false";
      },
      uppercase: function(object) {
        return object ? "TRUE" : "FALSE";
      },
      camelcase: function(object) {
        return object ? "True" : "False";
      }
    },
    defaultStyle: "lowercase"
  });
  int = new type("tag:yaml.org,2002:int", {
    kind: "scalar",
    resolve: resolveYamlInteger,
    construct: constructYamlInteger,
    predicate: isInteger,
    represent: {
      binary: function(obj) {
        return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
      },
      octal: function(obj) {
        return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
      },
      decimal: function(obj) {
        return obj.toString(10);
      },
      hexadecimal: function(obj) {
        return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
      }
    },
    defaultStyle: "decimal",
    styleAliases: {
      binary: [2, "bin"],
      octal: [8, "oct"],
      decimal: [10, "dec"],
      hexadecimal: [16, "hex"]
    }
  });
  YAML_FLOAT_PATTERN = new RegExp("^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?" + "|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?" + "|[-+]?\\.(?:inf|Inf|INF)" + "|\\.(?:nan|NaN|NAN))$");
  SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
  float = new type("tag:yaml.org,2002:float", {
    kind: "scalar",
    resolve: resolveYamlFloat,
    construct: constructYamlFloat,
    predicate: isFloat,
    represent: representYamlFloat,
    defaultStyle: "lowercase"
  });
  json = failsafe.extend({
    implicit: [
      _null,
      bool,
      int,
      float
    ]
  });
  core = json;
  YAML_DATE_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])" + "-([0-9][0-9])" + "-([0-9][0-9])$");
  YAML_TIMESTAMP_REGEXP = new RegExp("^([0-9][0-9][0-9][0-9])" + "-([0-9][0-9]?)" + "-([0-9][0-9]?)" + "(?:[Tt]|[ \\t]+)" + "([0-9][0-9]?)" + ":([0-9][0-9])" + ":([0-9][0-9])" + "(?:\\.([0-9]*))?" + "(?:[ \\t]*(Z|([-+])([0-9][0-9]?)" + "(?::([0-9][0-9]))?))?$");
  timestamp = new type("tag:yaml.org,2002:timestamp", {
    kind: "scalar",
    resolve: resolveYamlTimestamp,
    construct: constructYamlTimestamp,
    instanceOf: Date,
    represent: representYamlTimestamp
  });
  merge = new type("tag:yaml.org,2002:merge", {
    kind: "scalar",
    resolve: resolveYamlMerge
  });
  binary = new type("tag:yaml.org,2002:binary", {
    kind: "scalar",
    resolve: resolveYamlBinary,
    construct: constructYamlBinary,
    predicate: isBinary,
    represent: representYamlBinary
  });
  _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
  _toString$2 = Object.prototype.toString;
  omap = new type("tag:yaml.org,2002:omap", {
    kind: "sequence",
    resolve: resolveYamlOmap,
    construct: constructYamlOmap
  });
  _toString$1 = Object.prototype.toString;
  pairs = new type("tag:yaml.org,2002:pairs", {
    kind: "sequence",
    resolve: resolveYamlPairs,
    construct: constructYamlPairs
  });
  _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
  set = new type("tag:yaml.org,2002:set", {
    kind: "mapping",
    resolve: resolveYamlSet,
    construct: constructYamlSet
  });
  _default = core.extend({
    implicit: [
      timestamp,
      merge
    ],
    explicit: [
      binary,
      omap,
      pairs,
      set
    ]
  });
  _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
  PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
  PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
  PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
  PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
  simpleEscapeCheck = new Array(256);
  simpleEscapeMap = new Array(256);
  for (i = 0;i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  directiveHandlers = {
    YAML: function handleYamlDirective(state, name, args) {
      var match, major, minor;
      if (state.version !== null) {
        throwError(state, "duplication of %YAML directive");
      }
      if (args.length !== 1) {
        throwError(state, "YAML directive accepts exactly one argument");
      }
      match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) {
        throwError(state, "ill-formed argument of the YAML directive");
      }
      major = parseInt(match[1], 10);
      minor = parseInt(match[2], 10);
      if (major !== 1) {
        throwError(state, "unacceptable YAML version of the document");
      }
      state.version = args[0];
      state.checkLineBreaks = minor < 2;
      if (minor !== 1 && minor !== 2) {
        throwWarning(state, "unsupported YAML version of the document");
      }
    },
    TAG: function handleTagDirective(state, name, args) {
      var handle, prefix;
      if (args.length !== 2) {
        throwError(state, "TAG directive accepts exactly two arguments");
      }
      handle = args[0];
      prefix = args[1];
      if (!PATTERN_TAG_HANDLE.test(handle)) {
        throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      }
      if (_hasOwnProperty$1.call(state.tagMap, handle)) {
        throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
      }
      if (!PATTERN_TAG_URI.test(prefix)) {
        throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      }
      try {
        prefix = decodeURIComponent(prefix);
      } catch (err) {
        throwError(state, "tag prefix is malformed: " + prefix);
      }
      state.tagMap[handle] = prefix;
    }
  };
  loadAll_1 = loadAll$1;
  load_1 = load$1;
  loader = {
    loadAll: loadAll_1,
    load: load_1
  };
  _toString = Object.prototype.toString;
  _hasOwnProperty = Object.prototype.hasOwnProperty;
  ESCAPE_SEQUENCES = {};
  ESCAPE_SEQUENCES[0] = "\\0";
  ESCAPE_SEQUENCES[7] = "\\a";
  ESCAPE_SEQUENCES[8] = "\\b";
  ESCAPE_SEQUENCES[9] = "\\t";
  ESCAPE_SEQUENCES[10] = "\\n";
  ESCAPE_SEQUENCES[11] = "\\v";
  ESCAPE_SEQUENCES[12] = "\\f";
  ESCAPE_SEQUENCES[13] = "\\r";
  ESCAPE_SEQUENCES[27] = "\\e";
  ESCAPE_SEQUENCES[34] = "\\\"";
  ESCAPE_SEQUENCES[92] = "\\\\";
  ESCAPE_SEQUENCES[133] = "\\N";
  ESCAPE_SEQUENCES[160] = "\\_";
  ESCAPE_SEQUENCES[8232] = "\\L";
  ESCAPE_SEQUENCES[8233] = "\\P";
  DEPRECATED_BOOLEANS_SYNTAX = [
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
  dump_1 = dump$1;
  dumper = {
    dump: dump_1
  };
  Type = type;
  Schema = schema;
  FAILSAFE_SCHEMA = failsafe;
  JSON_SCHEMA = json;
  CORE_SCHEMA = core;
  DEFAULT_SCHEMA = _default;
  load = loader.load;
  loadAll = loader.loadAll;
  dump = dumper.dump;
  YAMLException = exception;
  types = {
    binary,
    float,
    map,
    null: _null,
    pairs,
    set,
    timestamp,
    bool,
    int,
    merge,
    omap,
    seq,
    str
  };
  safeLoad = renamed("safeLoad", "load");
  safeLoadAll = renamed("safeLoadAll", "loadAll");
  safeDump = renamed("safeDump", "dump");
  jsYaml = {
    Type,
    Schema,
    FAILSAFE_SCHEMA,
    JSON_SCHEMA,
    CORE_SCHEMA,
    DEFAULT_SCHEMA,
    load,
    loadAll,
    dump,
    YAMLException,
    types,
    safeLoad,
    safeLoadAll,
    safeDump
  };
});

// src/config.ts
var exports_config = {};
__export(exports_config, {
  saveSystemConfig: () => saveSystemConfig,
  reloadSystemConfig: () => reloadSystemConfig,
  loadSystemConfig: () => loadSystemConfig,
  getSystemConfig: () => getSystemConfig,
  OKASTR8_HOME: () => OKASTR8_HOME,
  CONFIG_FILE: () => CONFIG_FILE
});
import { join as join6 } from "path";
import { homedir as homedir2 } from "os";
import { readFile as readFile2, writeFile as writeFile2, mkdir as mkdir2 } from "fs/promises";
import { existsSync as existsSync2 } from "fs";
function getHomeDir() {
  const sudoUser = process.env.SUDO_USER;
  if (sudoUser) {
    return `/home/${sudoUser}`;
  }
  return homedir2();
}
async function loadSystemConfig() {
  try {
    if (!existsSync2(CONFIG_FILE)) {
      configCache = {};
      return configCache;
    }
    const content = await readFile2(CONFIG_FILE, "utf-8");
    configCache = load(content) || {};
    return configCache;
  } catch (error) {
    console.error("Failed to load system.yaml:", error);
    return {};
  }
}
async function getSystemConfig() {
  if (configCache)
    return configCache;
  return await loadSystemConfig();
}
async function reloadSystemConfig() {
  configCache = null;
  return await loadSystemConfig();
}
async function saveSystemConfig(newConfig) {
  await mkdir2(OKASTR8_HOME, { recursive: true });
  const current = await getSystemConfig();
  const updatedConfig = {
    ...current,
    ...newConfig,
    setup: { ...current.setup, ...newConfig.setup },
    manager: { ...current.manager, ...newConfig.manager },
    tunnel: { ...current.tunnel, ...newConfig.tunnel }
  };
  if (newConfig.manager?.github && current.manager?.github) {
    if (!updatedConfig.manager)
      updatedConfig.manager = {};
    updatedConfig.manager.github = { ...current.manager.github, ...newConfig.manager.github };
  }
  configCache = updatedConfig;
  const yamlContent = dump(updatedConfig, { indent: 2 });
  await writeFile2(CONFIG_FILE, yamlContent, "utf-8");
}
var OKASTR8_HOME, CONFIG_FILE, configCache = null;
var init_config = __esm(() => {
  init_js_yaml();
  OKASTR8_HOME = join6(getHomeDir(), ".okastr8");
  CONFIG_FILE = join6(OKASTR8_HOME, "system.yaml");
});

// src/utils/cli-logger.ts
class TaskProgress {
  steps;
  currentStepKey = null;
  spinnerIndex = 0;
  spinnerInterval = null;
  lastMessage = "";
  constructor(steps) {
    this.steps = steps;
  }
  get currentStepIndex() {
    if (!this.currentStepKey)
      return 0;
    const index = this.steps.indexOf(this.currentStepKey);
    return index !== -1 ? index + 1 : 0;
  }
  render(message, isFinal = false, status = "progress") {
    const stepIndex = this.currentStepIndex;
    const stepTotal = this.steps.length;
    const progressPrefix = stepTotal > 0 ? `[${stepIndex}/${stepTotal}] ` : "";
    let symbol = "";
    if (isFinal) {
      symbol = status === "success" ? `${colors.green}DONE${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    } else {
      symbol = `${colors.cyan}${frames[this.spinnerIndex]}${colors.reset}`;
    }
    const line = `\r${symbol} ${colors.bold}${progressPrefix}${colors.reset}${message}`;
    process.stdout.write("\x1B[2K");
    process.stdout.write(line + (isFinal ? `
` : ""));
    this.lastMessage = message;
  }
  step(key, message) {
    this.currentStepKey = key;
    this.lastMessage = message;
    if (!this.spinnerInterval) {
      this.spinnerInterval = setInterval(() => {
        this.spinnerIndex = (this.spinnerIndex + 1) % frames.length;
        this.render(this.lastMessage);
      }, 80);
    }
    this.render(message);
  }
  log(message) {
    this.lastMessage = message;
    this.render(message);
  }
  success(message) {
    this.stopSpinner();
    this.render(message, true, "success");
  }
  fail(message) {
    this.stopSpinner();
    this.render(message, true, "fail");
  }
  stopSpinner() {
    if (this.spinnerInterval) {
      clearInterval(this.spinnerInterval);
      this.spinnerInterval = null;
    }
  }
}
var colors, frames;
var init_cli_logger = __esm(() => {
  colors = {
    red: "\x1B[31m",
    green: "\x1B[32m",
    yellow: "\x1B[33m",
    blue: "\x1B[34m",
    cyan: "\x1B[36m",
    reset: "\x1B[0m",
    bold: "\x1B[1m",
    dim: "\x1B[2m"
  };
  frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
});

// src/utils/runtime-detector.ts
var exports_runtime_detector = {};
__export(exports_runtime_detector, {
  detectRuntime: () => detectRuntime
});
import { existsSync as existsSync3 } from "fs";
import { join as join7 } from "path";
async function detectRuntime(releasePath) {
  if (existsSync3(join7(releasePath, "package.json")) || existsSync3(join7(releasePath, "package-lock.json"))) {
    return "node";
  }
  if (existsSync3(join7(releasePath, "requirements.txt")) || existsSync3(join7(releasePath, "Pipfile")) || existsSync3(join7(releasePath, "setup.py")) || existsSync3(join7(releasePath, "pyproject.toml"))) {
    return "python";
  }
  if (existsSync3(join7(releasePath, "go.mod"))) {
    return "go";
  }
  if (existsSync3(join7(releasePath, "Cargo.toml"))) {
    return "rust";
  }
  if (existsSync3(join7(releasePath, "Gemfile"))) {
    return "ruby";
  }
  if (existsSync3(join7(releasePath, "bun.lockb"))) {
    return "bun";
  }
  if (existsSync3(join7(releasePath, "deno.json")) || existsSync3(join7(releasePath, "deno.jsonc"))) {
    return "deno";
  }
  throw new Error("Could not auto-detect runtime. Please specify 'runtime' in okastr8.yaml.\\n" + "Supported runtimes: node, python, go, rust, ruby, bun, deno");
}
var init_runtime_detector = () => {};

// src/utils/dockerfile-generator.ts
function normalizeStartCommandForDocker(startCommand) {
  const cmd = startCommand.trim();
  if (/\bvite\b/.test(cmd) && !cmd.includes("--host")) {
    return cmd + " --host";
  }
  if (/\bnext\s+dev\b/.test(cmd) && !cmd.includes("-H ") && !cmd.includes("--hostname")) {
    return cmd + " -H 0.0.0.0";
  }
  if (/\bwebpack\s+serve\b/.test(cmd) && !cmd.includes("--host")) {
    return cmd + " --host 0.0.0.0";
  }
  if (/\bng\s+serve\b/.test(cmd) && !cmd.includes("--host")) {
    return cmd + " --host 0.0.0.0";
  }
  if (/\bnuxt\s+dev\b/.test(cmd) && !cmd.includes("--host") && !cmd.includes("-H")) {
    return cmd + " --host";
  }
  if (/\bastro\s+dev\b/.test(cmd) && !cmd.includes("--host")) {
    return cmd + " --host";
  }
  return cmd;
}
function generateDockerfile(config) {
  const runtime = config.runtime || "node";
  switch (runtime.toLowerCase()) {
    case "node":
      return generateNodeDockerfile(config);
    case "python":
      return generatePythonDockerfile(config);
    case "go":
      return generateGoDockerfile(config);
    case "bun":
      return generateBunDockerfile(config);
    case "deno":
      return generateDenoDockerfile(config);
    default:
      throw new Error(`Unsupported runtime: ${runtime}`);
  }
}
function generateNodeDockerfile(config) {
  return `# Auto-generated by okastr8
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY . .

# Run build steps if any
${config.buildSteps.length > 0 ? `RUN ${config.buildSteps.join(" && ")}` : "# No build steps"}

# Expose port
EXPOSE ${config.port}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget --spider -q http://localhost:${config.port}/health || exit 1

# Start application
CMD ${JSON.stringify(normalizeStartCommandForDocker(config.startCommand).split(" "))}
`;
}
function generatePythonDockerfile(config) {
  return `# Auto-generated by okastr8
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run build steps if any
${config.buildSteps.length > 0 ? `RUN ${config.buildSteps.join(" && ")}` : "# No build steps"}

# Expose port
EXPOSE ${config.port}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:${config.port}/health || exit 1

# Start application
CMD ${JSON.stringify(normalizeStartCommandForDocker(config.startCommand).split(" "))}
`;
}
function generateGoDockerfile(config) {
  return `# Auto-generated by okastr8
# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN go build -o main .

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk --no-cache add ca-certificates wget

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port
EXPOSE ${config.port}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget --spider -q http://localhost:${config.port}/health || exit 1

# Start application
CMD ["./main"]
`;
}
function generateBunDockerfile(config) {
  return `# Auto-generated by okastr8
FROM oven/bun:1-alpine

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --production

# Copy application code
COPY . .

# Run build steps if any
${config.buildSteps.length > 0 ? `RUN ${config.buildSteps.join(" && ")}` : "# No build steps"}

# Expose port
EXPOSE ${config.port}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget --spider -q http://localhost:${config.port}/health || exit 1

# Start application
CMD ${JSON.stringify(normalizeStartCommandForDocker(config.startCommand).split(" "))}
`;
}
function generateDenoDockerfile(config) {
  return `# Auto-generated by okastr8
FROM denoland/deno:alpine

WORKDIR /app

# Cache dependencies
COPY deno.json deno.lock ./
RUN deno cache deno.json

# Copy application code
COPY . .

# Expose port
EXPOSE ${config.port}

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget --spider -q http://localhost:${config.port}/health || exit 1

# Start application
CMD ${JSON.stringify(normalizeStartCommandForDocker(config.startCommand).split(" "))}
`;
}

// src/utils/compose-generator.ts
import { writeFile as writeFile3 } from "fs/promises";
import { join as join8 } from "path";
function generateCompose(config, appName, envFilePath) {
  const services = {
    app: {
      build: ".",
      container_name: appName,
      ports: [`${config.port}:${config.port}`],
      restart: "unless-stopped",
      healthcheck: {
        test: [
          "CMD",
          "wget",
          "--spider",
          "-q",
          `http://localhost:${config.port}/health`
        ],
        interval: "10s",
        timeout: "5s",
        retries: 3,
        start_period: "10s"
      }
    }
  };
  if (envFilePath) {
    services.app.env_file = [envFilePath];
  }
  const environment = {};
  const dependsOn = {};
  if (config.database) {
    const dbService = parseDatabaseService(config.database);
    services[dbService.name] = dbService.config;
    dependsOn[dbService.name] = { condition: "service_healthy" };
    environment[dbService.envKey] = dbService.envValue;
  }
  if (config.cache) {
    const cacheService = parseCacheService(config.cache);
    services[cacheService.name] = cacheService.config;
    dependsOn[cacheService.name] = { condition: "service_healthy" };
    environment[cacheService.envKey] = cacheService.envValue;
  }
  if (Object.keys(environment).length > 0) {
    services.app.environment = environment;
  }
  if (Object.keys(dependsOn).length > 0) {
    services.app.depends_on = dependsOn;
  }
  const compose = {
    version: "3.8",
    services
  };
  if (config.database) {
    compose.volumes = {
      [`${appName}_dbdata`]: {}
    };
  }
  return toYAML(compose);
}
function parseDatabaseService(database) {
  const parts = database.split(":");
  const type2 = parts[0];
  const version = parts[1] || "latest";
  if (!type2) {
    throw new Error("Database type not specified");
  }
  const dbName = "database";
  switch (type2.toLowerCase()) {
    case "postgres":
    case "postgresql":
      return {
        name: dbName,
        config: {
          image: `postgres:${version}`,
          container_name: `${dbName}-postgres`,
          environment: {
            POSTGRES_USER: "user",
            POSTGRES_PASSWORD: "changeme",
            POSTGRES_DB: "app"
          },
          volumes: [`\${COMPOSE_PROJECT_NAME:-app}_dbdata:/var/lib/postgresql/data`],
          restart: "unless-stopped",
          healthcheck: {
            test: ["CMD-SHELL", "pg_isready -U user"],
            interval: "5s",
            timeout: "5s",
            retries: 5
          }
        },
        envKey: "DATABASE_URL",
        envValue: "postgres://user:changeme@database:5432/app"
      };
    case "mysql":
      return {
        name: dbName,
        config: {
          image: `mysql:${version}`,
          container_name: `${dbName}-mysql`,
          environment: {
            MYSQL_ROOT_PASSWORD: "changeme",
            MYSQL_DATABASE: "app",
            MYSQL_USER: "user",
            MYSQL_PASSWORD: "changeme"
          },
          volumes: [`\${COMPOSE_PROJECT_NAME:-app}_dbdata:/var/lib/mysql`],
          restart: "unless-stopped",
          healthcheck: {
            test: ["CMD", "mysqladmin", "ping", "-h", "localhost"],
            interval: "5s",
            timeout: "5s",
            retries: 5
          }
        },
        envKey: "DATABASE_URL",
        envValue: "mysql://user:changeme@database:3306/app"
      };
    case "mongodb":
    case "mongo":
      return {
        name: dbName,
        config: {
          image: `mongo:${version}`,
          container_name: `${dbName}-mongo`,
          environment: {
            MONGO_INITDB_ROOT_USERNAME: "user",
            MONGO_INITDB_ROOT_PASSWORD: "changeme"
          },
          volumes: [`\${COMPOSE_PROJECT_NAME:-app}_dbdata:/data/db`],
          restart: "unless-stopped",
          healthcheck: {
            test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"],
            interval: "5s",
            timeout: "5s",
            retries: 5
          }
        },
        envKey: "MONGODB_URI",
        envValue: "mongodb://user:changeme@database:27017"
      };
    case "mariadb":
      return {
        name: dbName,
        config: {
          image: `mariadb:${version}`,
          container_name: `${dbName}-mariadb`,
          environment: {
            MARIADB_ROOT_PASSWORD: "changeme",
            MARIADB_DATABASE: "app",
            MARIADB_USER: "user",
            MARIADB_PASSWORD: "changeme"
          },
          volumes: [`\${COMPOSE_PROJECT_NAME:-app}_dbdata:/var/lib/mysql`],
          restart: "unless-stopped",
          healthcheck: {
            test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"],
            interval: "5s",
            timeout: "5s",
            retries: 5
          }
        },
        envKey: "DATABASE_URL",
        envValue: "mysql://user:changeme@database:3306/app"
      };
    default:
      throw new Error(`Unsupported database type: ${type2}`);
  }
}
function parseCacheService(cache) {
  const parts = cache.split(":");
  const type2 = parts[0];
  const version = parts[1] || "latest";
  if (!type2) {
    throw new Error("Cache type not specified");
  }
  const cacheName = "cache";
  switch (type2.toLowerCase()) {
    case "redis":
      return {
        name: cacheName,
        config: {
          image: `redis:${version}-alpine`,
          container_name: `${cacheName}-redis`,
          restart: "unless-stopped",
          healthcheck: {
            test: ["CMD", "redis-cli", "ping"],
            interval: "5s",
            timeout: "5s",
            retries: 5
          }
        },
        envKey: "REDIS_URL",
        envValue: "redis://cache:6379"
      };
    default:
      throw new Error(`Unsupported cache type: ${type2}`);
  }
}
function toYAML(obj, indent = 0) {
  const spaces = "  ".repeat(indent);
  let yaml = "";
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      yaml += `${spaces}${key}:
`;
      value.forEach((item) => {
        if (typeof item === "object") {
          yaml += `${spaces}  - ${toYAML(item, indent + 2).trim()}
`;
        } else {
          yaml += `${spaces}  - ${item}
`;
        }
      });
    } else if (typeof value === "object") {
      yaml += `${spaces}${key}:
`;
      yaml += toYAML(value, indent + 1);
    } else if (typeof value === "string") {
      const needsQuotes = value.includes(":") || value.includes("#") || value.startsWith("$");
      yaml += `${spaces}${key}: ${needsQuotes ? `"${value}"` : value}
`;
    } else {
      yaml += `${spaces}${key}: ${value}
`;
    }
  }
  return yaml;
}
async function saveGeneratedFiles(releasePath, config, appName, envFilePath) {
  const files = {
    dockerfile: join8(releasePath, "Dockerfile.generated")
  };
  const dockerfile = generateDockerfile(config);
  await writeFile3(files.dockerfile, dockerfile, "utf-8");
  if (config.database || config.cache) {
    files.compose = join8(releasePath, "docker-compose.generated.yml");
    const compose = generateCompose(config, appName, envFilePath);
    await writeFile3(files.compose, compose, "utf-8");
  }
  return files;
}
var init_compose_generator = () => {};

// src/commands/docker.ts
var exports_docker = {};
__export(exports_docker, {
  stopContainer: () => stopContainer,
  runContainer: () => runContainer,
  restartContainer: () => restartContainer,
  removeContainer: () => removeContainer,
  listContainers: () => listContainers,
  getProjectContainers: () => getProjectContainers,
  containerStatus: () => containerStatus,
  containerLogs: () => containerLogs,
  composeUp: () => composeUp,
  composeDown: () => composeDown,
  checkDockerInstalled: () => checkDockerInstalled,
  checkComposeInstalled: () => checkComposeInstalled,
  buildImage: () => buildImage
});
import { existsSync as existsSync4 } from "fs";
function getDockerPath() {
  const paths = ["/usr/bin/docker", "/usr/local/bin/docker"];
  for (const p of paths) {
    if (existsSync4(p))
      return p;
  }
  return "docker";
}
function getComposePath() {
  const paths = ["/usr/bin/docker-compose", "/usr/local/bin/docker-compose", "/usr/local/lib/docker/cli-plugins/docker-compose"];
  for (const p of paths) {
    if (existsSync4(p))
      return p;
  }
  return "docker-compose";
}
async function dockerCommand(args, cwd) {
  return runCommand("sudo", [getDockerPath(), ...args], cwd);
}
async function composeCommand(args, cwd) {
  return runCommand("sudo", [getComposePath(), ...args], cwd);
}
async function buildImage(appName, tag, context, dockerfilePath = "Dockerfile") {
  try {
    const result = await dockerCommand([
      "build",
      "-t",
      tag,
      "-f",
      dockerfilePath,
      context
    ]);
    if (result.exitCode !== 0) {
      return {
        success: false,
        message: `Docker build failed: ${result.stderr}`
      };
    }
    return {
      success: true,
      message: `Successfully built image: ${tag}`
    };
  } catch (error) {
    return {
      success: false,
      message: `Build error: ${error.message}`
    };
  }
}
async function runContainer(appName, image, port, envFilePath) {
  try {
    const containerName = appName;
    const args = [
      "run",
      "-d",
      "--name",
      containerName,
      "-p",
      `${port}:${port}`,
      "--restart",
      "unless-stopped",
      "-e",
      "HOST=0.0.0.0"
    ];
    if (envFilePath) {
      args.push("--env-file", envFilePath);
    }
    args.push(image);
    const result = await dockerCommand(args);
    if (result.exitCode !== 0) {
      return {
        success: false,
        message: `Failed to run container: ${result.stderr}`
      };
    }
    return {
      success: true,
      message: `Container ${containerName} started successfully`
    };
  } catch (error) {
    return {
      success: false,
      message: `Run error: ${error.message}`
    };
  }
}
async function composeUp(composePaths, projectName) {
  try {
    const paths = Array.isArray(composePaths) ? composePaths : [composePaths];
    const fileArgs = paths.flatMap((p) => ["-f", p]);
    const result = await composeCommand([...fileArgs, "-p", projectName, "up", "-d", "--build"], process.cwd());
    if (result.exitCode !== 0) {
      return {
        success: false,
        message: `docker-compose up failed: ${result.stderr}`
      };
    }
    return {
      success: true,
      message: `Services started successfully`
    };
  } catch (error) {
    return {
      success: false,
      message: `Compose error: ${error.message}`
    };
  }
}
async function composeDown(composePath, projectName) {
  try {
    const result = await composeCommand(["-f", composePath, "-p", projectName, "down"], process.cwd());
    if (result.exitCode !== 0) {
      return {
        success: false,
        message: `docker-compose down failed: ${result.stderr}`
      };
    }
    return {
      success: true,
      message: `Services stopped successfully`
    };
  } catch (error) {
    return {
      success: false,
      message: `Compose error: ${error.message}`
    };
  }
}
async function stopContainer(containerName) {
  try {
    const result = await dockerCommand(["stop", containerName]);
    if (result.exitCode !== 0 && !result.stderr.includes("No such container")) {
      return {
        success: false,
        message: `Failed to stop container: ${result.stderr}`
      };
    }
    return {
      success: true,
      message: `Container ${containerName} stopped`
    };
  } catch (error) {
    return {
      success: false,
      message: `Stop error: ${error.message}`
    };
  }
}
async function removeContainer(containerName) {
  try {
    const result = await dockerCommand(["rm", "-f", containerName]);
    if (result.exitCode !== 0 && !result.stderr.includes("No such container")) {
      return {
        success: false,
        message: `Failed to remove container: ${result.stderr}`
      };
    }
    return {
      success: true,
      message: `Container ${containerName} removed`
    };
  } catch (error) {
    return {
      success: false,
      message: `Remove error: ${error.message}`
    };
  }
}
async function restartContainer(containerName) {
  try {
    const result = await dockerCommand(["restart", containerName]);
    if (result.exitCode !== 0) {
      return {
        success: false,
        message: `Failed to restart container: ${result.stderr}`
      };
    }
    return {
      success: true,
      message: `Container ${containerName} restarted`
    };
  } catch (error) {
    return {
      success: false,
      message: `Restart error: ${error.message}`
    };
  }
}
async function containerStatus(containerName) {
  try {
    const result = await dockerCommand([
      "inspect",
      "--format",
      "{{.State.Status}}|{{.State.Health.Status}}",
      containerName
    ]);
    if (result.exitCode !== 0) {
      return {
        running: false,
        status: "not found"
      };
    }
    const parts = result.stdout.trim().split("|");
    const status = parts[0] || "unknown";
    const healthRaw = parts[1] || "";
    const health = healthRaw && healthRaw !== "<no value>" ? healthRaw : undefined;
    return {
      running: status === "running",
      status,
      health
    };
  } catch (error) {
    return {
      running: false,
      status: "error"
    };
  }
}
async function containerLogs(containerName, lines = 50) {
  try {
    const result = await dockerCommand([
      "logs",
      "--tail",
      lines.toString(),
      containerName
    ]);
    return result.stdout || result.stderr || "No logs available";
  } catch (error) {
    return `Error fetching logs: ${error.message}`;
  }
}
async function listContainers() {
  try {
    const result = await runCommand("sudo", [
      "-n",
      getDockerPath(),
      "ps",
      "-a",
      "--format",
      "{{.Names}}|{{.Status}}|{{.State}}|{{.Ports}}"
    ]);
    if (result.exitCode !== 0) {
      return [];
    }
    const lines = result.stdout.trim().split(`
`).filter((line) => line && line.includes("|"));
    return lines.map((line) => {
      const [name = "", status = "", state = "", ports = ""] = line.split("|");
      return { name, status, state, ports };
    });
  } catch (error) {
    return [];
  }
}
async function getProjectContainers(projectName) {
  try {
    const result = await dockerCommand([
      "ps",
      "-a",
      "--filter",
      `label=com.docker.compose.project=${projectName}`,
      "--format",
      "{{.Names}}|{{.State}}|{{.Status}}"
    ]);
    if (result.exitCode !== 0) {
      return [];
    }
    const lines = result.stdout.trim().split(`
`).filter((line) => line && line.includes("|"));
    return lines.map((line) => {
      const [name = "", status = "", healthRaw = ""] = line.split("|");
      const health = healthRaw && healthRaw !== "<no value>" ? healthRaw : undefined;
      return { name, status, health };
    });
  } catch (error) {
    return [];
  }
}
async function checkDockerInstalled() {
  try {
    const result = await dockerCommand(["--version"]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
async function checkComposeInstalled() {
  try {
    const result = await composeCommand(["--version"]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
var init_docker = __esm(() => {
  init_command();
});

// src/utils/env-manager.ts
var exports_env_manager = {};
__export(exports_env_manager, {
  unsetEnvVar: () => unsetEnvVar,
  setEnvVar: () => setEnvVar,
  saveEnvVars: () => saveEnvVars,
  loadEnvVars: () => loadEnvVars,
  listEnvVars: () => listEnvVars,
  importEnvFile: () => importEnvFile,
  hasEnvVars: () => hasEnvVars,
  exportEnvFile: () => exportEnvFile
});
import { join as join9 } from "path";
import { readFile as readFile3, writeFile as writeFile4, unlink, mkdir as mkdir3 } from "fs/promises";
import { existsSync as existsSync5 } from "fs";
function getEnvFilePath(appName) {
  return join9(APPS_DIR, appName, ".env.production");
}
async function saveEnvVars(appName, vars) {
  const envFilePath = getEnvFilePath(appName);
  const appDir = join9(APPS_DIR, appName);
  if (!existsSync5(appDir)) {
    await mkdir3(appDir, { recursive: true });
  }
  const existing = await loadEnvVars(appName);
  const merged = { ...existing, ...vars };
  const content = Object.entries(merged).map(([key, value]) => `${key}=${value}`).join(`
`);
  await writeFile4(envFilePath, content, { mode: 384 });
}
async function loadEnvVars(appName) {
  const envFilePath = getEnvFilePath(appName);
  if (!existsSync5(envFilePath)) {
    return {};
  }
  try {
    const content = await readFile3(envFilePath, "utf-8");
    const vars = {};
    content.split(`
`).forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith("#")) {
        return;
      }
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        vars[key.trim()] = valueParts.join("=").trim();
      }
    });
    return vars;
  } catch (error) {
    throw new Error(`Failed to load env vars: ${error.message}`);
  }
}
async function importEnvFile(appName, filePath) {
  if (!existsSync5(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  try {
    const content = await readFile3(filePath, "utf-8");
    const vars = {};
    content.split(`
`).forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith("#")) {
        return;
      }
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        vars[key.trim()] = valueParts.join("=").trim();
      }
    });
    await saveEnvVars(appName, vars);
  } catch (error) {
    throw new Error(`Failed to import env file: ${error.message}`);
  }
}
async function exportEnvFile(appName, outputPath) {
  const vars = await loadEnvVars(appName);
  const content = Object.entries(vars).map(([key, value]) => `${key}=${value}`).join(`
`);
  await writeFile4(outputPath, content, "utf-8");
}
async function setEnvVar(appName, key, value) {
  await saveEnvVars(appName, { [key]: value });
}
async function unsetEnvVar(appName, key) {
  const vars = await loadEnvVars(appName);
  delete vars[key];
  const envFilePath = getEnvFilePath(appName);
  if (Object.keys(vars).length === 0) {
    if (existsSync5(envFilePath)) {
      await unlink(envFilePath);
    }
  } else {
    const content = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join(`
`);
    await writeFile4(envFilePath, content, { mode: 384 });
  }
}
async function listEnvVars(appName) {
  const vars = await loadEnvVars(appName);
  return Object.keys(vars);
}
async function hasEnvVars(appName) {
  const envFilePath = getEnvFilePath(appName);
  return existsSync5(envFilePath);
}
var APPS_DIR;
var init_env_manager = __esm(() => {
  init_config();
  APPS_DIR = join9(OKASTR8_HOME, "apps");
});

// src/commands/systemd.ts
var exports_systemd = {};
__export(exports_systemd, {
  stopService: () => stopService2,
  statusService: () => statusService2,
  startService: () => startService2,
  restartService: () => restartService2,
  reloadDaemon: () => reloadDaemon2,
  logsService: () => logsService2,
  listServices: () => listServices2,
  enableService: () => enableService2,
  disableService: () => disableService2,
  deleteService: () => deleteService2,
  createService: () => createService2,
  addSystemdCommands: () => addSystemdCommands2
});
import * as path3 from "path";
async function createService2(service_name, description, exec_start, working_directory, user, wanted_by, auto_start) {
  return await runCommand("sudo", [
    path3.join(SCRIPT_BASE_PATH3, "create.sh"),
    service_name,
    description,
    exec_start,
    working_directory,
    user,
    wanted_by,
    auto_start ? "true" : "false"
  ]);
}
async function deleteService2(service_name) {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "delete.sh"), service_name]);
}
async function startService2(service_name) {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "start.sh"), service_name]);
}
async function stopService2(service_name) {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "stop.sh"), service_name]);
}
async function restartService2(service_name) {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "restart.sh"), service_name]);
}
async function statusService2(service_name) {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "status.sh"), service_name]);
}
async function logsService2(service_name) {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "logs.sh"), service_name]);
}
async function enableService2(service_name) {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "enable.sh"), service_name]);
}
async function disableService2(service_name) {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "disable.sh"), service_name]);
}
async function reloadDaemon2() {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "reload.sh")]);
}
async function listServices2() {
  return await runCommand("sudo", [path3.join(SCRIPT_BASE_PATH3, "list.sh")]);
}
function addSystemdCommands2(program2) {
  const systemd = program2.command("systemd").description("Manage systemd services");
  systemd.command("create").description("Create a systemd service unit file").argument("<service_name>", "Name of the service").argument("<description>", "Description of the service").argument("<exec_start>", "Command to execute").argument("<working_directory>", "Working directory for the service").argument("<user>", "User to run the service as").argument("<wanted_by>", "Target to be wanted by (e.g., multi-user.target)").option("-a, --auto-start <boolean>", "Whether to enable and start the service automatically (default: true)", "true").action(async (service_name, description, exec_start, working_directory, user, wanted_by, options) => {
    const result = await createService2(service_name, description, exec_start, working_directory, user, wanted_by, options.autoStart === "true");
    console.log(result.stdout || result.stderr);
  });
  systemd.command("delete").description("Delete a systemd service unit file").argument("<service_name>", "Name of the service to delete").action(async (service_name) => {
    const result = await deleteService2(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("start").description("Start a systemd service").argument("<service_name>", "Name of the service to start").action(async (service_name) => {
    const result = await startService2(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("stop").description("Stop a systemd service").argument("<service_name>", "Name of the service to stop").action(async (service_name) => {
    const result = await stopService2(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("restart").description("Restart a systemd service").argument("<service_name>", "Name of the service to restart").action(async (service_name) => {
    const result = await restartService2(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("status").description("Show the status of a systemd service").argument("<service_name>", "Name of the service to check status").action(async (service_name) => {
    const result = await statusService2(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("logs").description("Show the last 50 log lines for a systemd service").argument("<service_name>", "Name of the service to show logs for").action(async (service_name) => {
    const result = await logsService2(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("enable").description("Enable a systemd service").argument("<service_name>", "Name of the service to enable").action(async (service_name) => {
    const result = await enableService2(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("disable").description("Disable a systemd service").argument("<service_name>", "Name of the service to disable").action(async (service_name) => {
    const result = await disableService2(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("reload").description("Reload the systemd daemon").action(async () => {
    const result = await reloadDaemon2();
    console.log(result.stdout || result.stderr);
  });
  systemd.command("list").description("List all okastr8 systemd service files").action(async () => {
    const result = await listServices2();
    console.log(result.stdout || result.stderr);
  });
}
var SCRIPT_BASE_PATH3;
var init_systemd = __esm(() => {
  init_command();
  SCRIPT_BASE_PATH3 = path3.join(process.cwd(), "scripts", "systemd");
});

// src/utils/deploy-docker.ts
var exports_deploy_docker = {};
__export(exports_deploy_docker, {
  detectDockerStrategy: () => detectDockerStrategy,
  deployWithDocker: () => deployWithDocker
});
import { join as join11 } from "path";
import { existsSync as existsSync6 } from "fs";
import { writeFile as writeFile5, readFile as readFile4 } from "fs/promises";
async function detectDockerStrategy(releasePath, config) {
  if (existsSync6(join11(releasePath, "docker-compose.yml"))) {
    return "user-compose";
  }
  if (existsSync6(join11(releasePath, "Dockerfile"))) {
    return "user-dockerfile";
  }
  if (config.database || config.cache) {
    return "auto-compose";
  }
  return "auto-dockerfile";
}
async function waitForHealth(containerName, maxWaitSeconds, log) {
  const pollIntervalMs = 2000;
  for (let elapsed = 0;elapsed < maxWaitSeconds; elapsed += 2) {
    const status = await containerStatus(containerName);
    if (!status.running) {
      if (status.status === "exited" || status.status === "dead") {
        log(`❌ Container ${containerName} exited unexpectedly`);
        return false;
      }
    }
    if (status.running) {
      if (status.health === "healthy") {
        log(`✅ Container ${containerName} is healthy`);
      } else if (status.health === "unhealthy") {
        log(`⚠️  Container ${containerName} running but HEALTHCHECK failed (this is often OK)`);
      } else {
        log(`✅ Container ${containerName} is running`);
      }
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  log(`⚠️  Health check timeout for ${containerName} after ${maxWaitSeconds}s`);
  return false;
}
async function deployWithDocker(options, config) {
  const { appName, releasePath, versionId, onProgress } = options;
  const log = onProgress || ((msg) => console.log(msg));
  const envFilePath = join11(releasePath, ".env");
  if (existsSync6(envFilePath)) {
    await importEnvFile(appName, envFilePath);
  }
  log("Ensuring clean slate for deployment...");
  await stopContainer(appName).catch(() => {});
  await removeContainer(appName).catch(() => {});
  const currentComposePath = join11(APPS_DIR2, appName, "current", "docker-compose.yml");
  if (existsSync6(currentComposePath)) {
    log("Stopping existing Compose services...");
    await composeDown(currentComposePath, appName).catch(() => {});
  }
  const { stopService: stopService3, disableService: disableService3 } = await Promise.resolve().then(() => (init_systemd(), exports_systemd));
  const serviceNames = [appName, appName.replace(/-/g, "_")];
  for (const serviceName of serviceNames) {
    try {
      log(`Checking legacy systemd service: ${serviceName}...`);
      await stopService3(serviceName).catch(() => {});
      await disableService3(serviceName).catch(() => {});
    } catch {}
  }
  const strategy = await detectDockerStrategy(releasePath, config);
  log(`Docker strategy: ${strategy}`);
  if (strategy === "user-compose" || strategy === "auto-compose") {
    return await deployWithCompose(appName, releasePath, config, strategy, existsSync6(envFilePath) ? envFilePath : undefined, log);
  } else {
    return await deployWithDockerfile(appName, releasePath, config, versionId, strategy, existsSync6(envFilePath) ? envFilePath : undefined, log);
  }
}
async function deployWithCompose(appName, releasePath, config, strategy, envFilePath, log) {
  let composePath;
  let overridePath;
  if (strategy === "auto-compose") {
    log("Generating docker-compose.yml...");
    const files = await saveGeneratedFiles(releasePath, config, appName, envFilePath);
    composePath = files.compose;
    log(`   Generated: ${composePath}`);
  } else {
    composePath = join11(releasePath, "docker-compose.yml");
    log(`   Using existing: ${composePath}`);
    if (envFilePath) {
      try {
        log("   Injecting environment variables via override file...");
        const composeContent = await readFile4(composePath, "utf-8");
        const composeYaml = load(composeContent);
        if (composeYaml && composeYaml.services) {
          const services = Object.keys(composeYaml.services);
          const override = {
            version: composeYaml.version || "3.8",
            services: {}
          };
          for (const service of services) {
            override.services[service] = {
              env_file: [envFilePath]
            };
          }
          overridePath = join11(releasePath, "docker-compose.override.yml");
          await writeFile5(overridePath, dump(override));
          log(`   Created override: ${overridePath}`);
        }
      } catch (e) {
        log(`Failed to generate env override: ${e.message}`);
      }
    }
  }
  const composeInstalled = await checkComposeInstalled();
  if (!composeInstalled) {
    return {
      success: false,
      message: "docker-compose is not installed. Please install: https://docs.docker.com/compose/install/",
      config
    };
  }
  log("Starting services...");
  const upResult = await composeUp(overridePath ? [composePath, overridePath] : composePath, appName);
  if (!upResult.success) {
    return {
      success: false,
      message: upResult.message,
      config
    };
  }
  const containers = await getProjectContainers(appName);
  const healthy = containers.every((c) => c.status.startsWith("Up") || c.status.includes("running"));
  if (!healthy) {
    return {
      success: false,
      message: "One or more services failed to start",
      config
    };
  }
  return {
    success: true,
    message: "Docker Compose deployment successful",
    config
  };
}
async function deployWithDockerfile(appName, releasePath, config, versionId, strategy, envFilePath, log) {
  if (strategy === "auto-dockerfile") {
    log("Generating Dockerfile...");
    const files = await saveGeneratedFiles(releasePath, config, appName);
    log(`   Generated: ${files.dockerfile}`);
  } else {
    log(`   Using existing Dockerfile`);
  }
  const tag = `${appName}:v${versionId}`;
  log(`Building Docker image: ${tag}...`);
  const dockerfileName = strategy === "auto-dockerfile" ? "Dockerfile.generated" : "Dockerfile";
  const dockerfilePath = join11(releasePath, dockerfileName);
  const buildResult = await buildImage(appName, tag, releasePath, dockerfilePath);
  if (!buildResult.success) {
    return {
      success: false,
      message: buildResult.message,
      config
    };
  }
  log("Starting new container...");
  const runResult = await runContainer(appName, tag, config.port, envFilePath);
  if (!runResult.success) {
    return {
      success: false,
      message: runResult.message,
      config
    };
  }
  log("Waiting for container to be healthy...");
  const healthy = await waitForHealth(appName, 60, log);
  if (!healthy) {
    return {
      success: false,
      message: "Container started but health check failed",
      config
    };
  }
  return {
    success: true,
    message: `Successfully deployed ${appName} (v${versionId})`,
    config
  };
}
var APPS_DIR2;
var init_deploy_docker = __esm(() => {
  init_js_yaml();
  init_compose_generator();
  init_docker();
  init_config();
  init_env_manager();
  APPS_DIR2 = join11(OKASTR8_HOME, "apps");
});

// src/commands/version.ts
var exports_version = {};
__export(exports_version, {
  updateVersionStatus: () => updateVersionStatus,
  setCurrentVersion: () => setCurrentVersion,
  rollback: () => rollback,
  removeVersion: () => removeVersion,
  initializeVersioning: () => initializeVersioning,
  getVersions: () => getVersions,
  getCurrentVersion: () => getCurrentVersion,
  createVersion: () => createVersion,
  cleanOldVersions: () => cleanOldVersions
});
import { readFile as readFile5, writeFile as writeFile6, mkdir as mkdir4, rm, symlink, unlink as unlink2, rename } from "fs/promises";
import { existsSync as existsSync7 } from "fs";
import { join as join12 } from "path";
function getAppJsonPath(appName) {
  return join12(APPS_DIR3, appName, "app.json");
}
function getReleasesDir(appName) {
  return join12(APPS_DIR3, appName, "releases");
}
function getCurrentPath(appName) {
  return join12(APPS_DIR3, appName, "current");
}
async function getVersions(appName) {
  const appJsonPath = getAppJsonPath(appName);
  const versionsJsonPath = join12(APPS_DIR3, appName, "versions.json");
  let versions = [];
  let currentVersionId = null;
  if (existsSync7(versionsJsonPath)) {
    try {
      const legacyContent = await readFile5(versionsJsonPath, "utf-8");
      const legacyData = JSON.parse(legacyContent);
      versions = legacyData.versions || [];
      currentVersionId = legacyData.current || null;
      await updateAppJson(appName, { versions, currentVersionId });
      await unlink2(versionsJsonPath);
    } catch (e) {
      console.warn(`Failed to migrate versions.json for ${appName}:`, e);
    }
  } else if (existsSync7(appJsonPath)) {
    try {
      const content = await readFile5(appJsonPath, "utf-8");
      const appData = JSON.parse(content);
      versions = appData.versions || [];
      currentVersionId = appData.currentVersionId || null;
    } catch {
      versions = [];
      currentVersionId = null;
    }
  }
  return {
    versions,
    current: currentVersionId,
    maxVersions: 5
  };
}
async function updateAppJson(appName, updates) {
  const appJsonPath = getAppJsonPath(appName);
  let currentData = {};
  const appDir = join12(APPS_DIR3, appName);
  if (!existsSync7(appDir)) {
    await mkdir4(appDir, { recursive: true });
  }
  if (existsSync7(appJsonPath)) {
    try {
      const content = await readFile5(appJsonPath, "utf-8");
      currentData = JSON.parse(content);
    } catch {}
  } else {
    currentData = {
      name: appName,
      createdAt: new Date().toISOString()
    };
  }
  const newData = { ...currentData, ...updates };
  await writeFile6(appJsonPath, JSON.stringify(newData, null, 2));
}
async function saveVersions(appName, versions, currentVersionId) {
  await updateAppJson(appName, { versions, currentVersionId });
}
async function createVersion(appName, commit, branch) {
  const data = await getVersions(appName);
  const releasesDir = getReleasesDir(appName);
  await mkdir4(releasesDir, { recursive: true });
  const maxId = data.versions.reduce((max, v) => Math.max(max, v.id), 0);
  const newId = maxId + 1;
  const newVersion = {
    id: newId,
    commit,
    branch,
    timestamp: new Date().toISOString(),
    status: "pending"
  };
  data.versions.push(newVersion);
  await saveVersions(appName, data.versions, data.current);
  const releasePath = join12(releasesDir, `v${newId}`);
  return { versionId: newId, releasePath };
}
async function updateVersionStatus(appName, versionId, status, message) {
  const data = await getVersions(appName);
  const version = data.versions.find((v) => v.id === versionId);
  if (version) {
    version.status = status;
    if (message)
      version.message = message;
    await saveVersions(appName, data.versions, data.current);
  }
}
async function setCurrentVersion(appName, versionId) {
  const data = await getVersions(appName);
  const version = data.versions.find((v) => v.id === versionId);
  if (!version)
    return false;
  const releasePath = join12(getReleasesDir(appName), `v${versionId}`);
  const currentPath = getCurrentPath(appName);
  if (!existsSync7(releasePath))
    return false;
  try {
    if (existsSync7(currentPath)) {
      await unlink2(currentPath);
    }
  } catch {}
  await symlink(releasePath, currentPath);
  await saveVersions(appName, data.versions, versionId);
  return true;
}
async function rollback(appName, versionId, onProgress) {
  const log = onProgress || ((msg) => console.log(msg));
  const data = await getVersions(appName);
  const version = data.versions.find((v) => v.id === versionId);
  if (!version) {
    return { success: false, message: `Version ${versionId} not found` };
  }
  if (version.status !== "success") {
    return { success: false, message: `Cannot rollback to ${version.status} version` };
  }
  const releasePath = join12(getReleasesDir(appName), `v${versionId}`);
  if (!existsSync7(releasePath)) {
    return { success: false, message: `Release artifact v${versionId} missing` };
  }
  log(`Rolling back ${appName} to v${versionId}...`);
  const { deployFromPath } = await Promise.resolve().then(() => (init_deploy_core(), exports_deploy_core));
  const result = await deployFromPath({
    appName,
    releasePath,
    versionId,
    gitBranch: version.branch,
    onProgress: log
  });
  if (result.success) {
    log(`✅ Rollback to v${versionId} complete!`);
  } else {
    log(`❌ Rollback failed: ${result.message}`);
  }
  return result;
}
async function removeVersion(appName, versionId) {
  const releasePath = join12(getReleasesDir(appName), `v${versionId}`);
  try {
    await rm(releasePath, { recursive: true, force: true });
  } catch {}
  const data = await getVersions(appName);
  const newVersions = data.versions.filter((v) => v.id !== versionId);
  let newCurrent = data.current;
  if (data.current === versionId) {
    newCurrent = null;
  }
  await saveVersions(appName, newVersions, newCurrent);
}
async function cleanOldVersions(appName) {
  const data = await getVersions(appName);
  const maxVersions = data.maxVersions || 5;
  const successfulVersions = data.versions.filter((v) => v.status === "success").sort((a, b) => b.id - a.id);
  const versionsToDelete = successfulVersions.slice(maxVersions).filter((v) => v.id !== data.current);
  const failedVersions = successfulVersions.length > 0 ? data.versions.filter((v) => v.status === "failed" && v.id < successfulVersions[0].id) : [];
  const allToDelete = [...versionsToDelete, ...failedVersions];
  for (const version of allToDelete) {
    const releasePath = join12(getReleasesDir(appName), `v${version.id}`);
    try {
      await rm(releasePath, { recursive: true, force: true });
    } catch {}
    const index = data.versions.findIndex((v) => v.id === version.id);
    if (index !== -1)
      data.versions.splice(index, 1);
  }
  await saveVersions(appName, data.versions, data.current);
}
async function initializeVersioning(appName) {
  const data = await getVersions(appName);
  if (data.versions.length > 0)
    return;
  const appDir = join12(APPS_DIR3, appName);
  const legacyRepo = join12(appDir, "repo");
  const releasesDir = getReleasesDir(appName);
  const v1Path = join12(releasesDir, "v1");
  const currentPath = getCurrentPath(appName);
  if (existsSync7(legacyRepo)) {
    await mkdir4(releasesDir, { recursive: true });
    if (!existsSync7(v1Path)) {
      await rename(legacyRepo, v1Path);
    }
    if (existsSync7(currentPath))
      await unlink2(currentPath);
    await symlink(v1Path, currentPath);
    const v1 = {
      id: 1,
      commit: "legacy-import",
      branch: "main",
      timestamp: new Date().toISOString(),
      status: "success",
      message: "Migrated from legacy deployment"
    };
    await saveVersions(appName, [v1], 1);
  }
}
async function getCurrentVersion(appName) {
  const data = await getVersions(appName);
  if (!data.current)
    return null;
  return data.versions.find((v) => v.id === data.current) || null;
}
var APPS_DIR3;
var init_version = __esm(() => {
  init_config();
  APPS_DIR3 = join12(OKASTR8_HOME, "apps");
});

// src/utils/genCaddyFile.ts
var exports_genCaddyFile = {};
__export(exports_genCaddyFile, {
  genCaddyFile: () => genCaddyFile
});
import { join as join13, dirname as dirname3 } from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import { homedir as homedir3 } from "os";
async function genCaddyFile() {
  try {
    const { readdir, readFile: readFile6, stat } = await import("fs/promises");
    const { join: join14 } = await import("path");
    const { OKASTR8_HOME: OKASTR8_HOME2 } = await Promise.resolve().then(() => (init_config(), exports_config));
    const appsDir = join14(OKASTR8_HOME2, "apps");
    let appsToCheck = [];
    try {
      appsToCheck = await readdir(appsDir);
    } catch {
      appsToCheck = [];
    }
    const caddyEntries = [];
    for (const appName of appsToCheck) {
      try {
        const appMetadataPath = join14(appsDir, appName, "app.json");
        const content = await readFile6(appMetadataPath, "utf-8");
        const metadata = JSON.parse(content);
        const domain = metadata.networking?.domain || metadata.domain;
        const port = metadata.networking?.port || metadata.port;
        if (domain && port) {
          const scheme = domain.endsWith(".localhost") ? "http://" : "";
          caddyEntries.push(`${scheme}${domain} {
  reverse_proxy localhost:${port}
}`);
          console.log(`  Added route: ${domain} -> :${port} (${appName})`);
        }
      } catch (e) {
        continue;
      }
    }
    const globalOptions = `{
  servers {
    metrics
  }
}
`;
    const caddyFile = globalOptions + caddyEntries.join(`

`) + `
`;
    const pathToWriteCaddyfile = join14(PROJECT_ROOT2, "scripts", "caddy", "writeCaddyfile.sh");
    const writeResult = await runCommand("sudo", [pathToWriteCaddyfile], undefined, caddyFile);
    if (writeResult.exitCode !== 0) {
      throw new Error(`Failed to write Caddyfile: ${writeResult.stderr}`);
    }
    const pathToReloadCaddy = join14(PROJECT_ROOT2, "scripts", "caddy", "reloadCaddy.sh");
    await runCommand("sudo", [pathToReloadCaddy]);
    console.log(`Caddyfile regenerated with ${caddyEntries.length} routes at ${caddyFilePath}`);
  } catch (e) {
    console.error("❌ Error generating Caddyfile:", e);
  }
}
var __filename3, __dirname3, PROJECT_ROOT2, userConfigPath, caddyFilePath = "/etc/caddy/Caddyfile";
var init_genCaddyFile = __esm(() => {
  init_command();
  __filename3 = fileURLToPath2(import.meta.url);
  __dirname3 = dirname3(__filename3);
  PROJECT_ROOT2 = join13(__dirname3, "..", "..");
  userConfigPath = `${homedir3()}/.okastr8/config.json`;
});

// src/commands/deploy-core.ts
var exports_deploy_core = {};
__export(exports_deploy_core, {
  deployFromPath: () => deployFromPath
});
import { join as join14 } from "path";
import { readFile as readFile6, readdir } from "fs/promises";
import { existsSync as existsSync8 } from "fs";
async function deployFromPath(options) {
  const { appName, releasePath, versionId, gitRepo, gitBranch, onProgress } = options;
  const task = new TaskProgress([
    "config",
    "runtime",
    "port",
    "deploy",
    "symlink",
    "metadata",
    "proxy"
  ]);
  const log = (msg) => {
    task.log(msg);
    if (onProgress)
      onProgress(msg);
  };
  const appDir = join14(APPS_DIR4, appName);
  const currentPath = join14(appDir, "current");
  task.step("config", "Loading application configuration...");
  const configPath = join14(releasePath, "okastr8.yaml");
  if (!existsSync8(configPath)) {
    task.fail(`okastr8.yaml not found at ${configPath}`);
    return {
      success: false,
      message: `okastr8.yaml not found at ${configPath}`
    };
  }
  let config;
  try {
    const { load: load2 } = await Promise.resolve().then(() => (init_js_yaml(), exports_js_yaml));
    const configContent = await readFile6(configPath, "utf-8");
    const rawConfig = load2(configContent);
    config = {
      runtime: rawConfig.runtime,
      buildSteps: rawConfig.build || [],
      startCommand: rawConfig.start || "",
      port: rawConfig.networking?.port || rawConfig.port || 3000,
      domain: rawConfig.networking?.domain || rawConfig.domain,
      database: rawConfig.database,
      cache: rawConfig.cache
    };
    log(`Configuration loaded`);
  } catch (error) {
    task.fail(`Failed to parse okastr8.yaml: ${error.message}`);
    return {
      success: false,
      message: `Failed to parse okastr8.yaml: ${error.message}`
    };
  }
  if (!config.startCommand) {
    task.fail("No start command specified in okastr8.yaml");
    return {
      success: false,
      message: "No start command specified in okastr8.yaml",
      config
    };
  }
  if (!config.port) {
    task.fail("No port specified in okastr8.yaml");
    return {
      success: false,
      message: "No port specified in okastr8.yaml. Port is required for health checks.",
      config
    };
  }
  try {
    task.step("port", `Checking port ${config.port} availability...`);
    await checkPortAvailability(config.port, appName, log);
  } catch (error) {
    task.fail(`Port conflict: ${error.message}`);
    return {
      success: false,
      message: `Port conflict detected: ${error.message}`,
      config
    };
  }
  if (!config.runtime) {
    task.step("runtime", "Auto-detecting runtime...");
    const { detectRuntime: detectRuntime2 } = await Promise.resolve().then(() => (init_runtime_detector(), exports_runtime_detector));
    try {
      config.runtime = await detectRuntime2(releasePath);
      log(`Detected: ${config.runtime}`);
    } catch (error) {
      task.fail(error.message);
      return {
        success: false,
        message: error.message,
        config
      };
    }
  } else {
    log(`Runtime: ${config.runtime}`);
  }
  task.step("deploy", "Deploying with Docker...");
  log(`\uD83D\uDCA1 Tip: Apps must bind to 0.0.0.0 (not localhost) to be accessible. We inject HOST=0.0.0.0 automatically.`);
  const { deployWithDocker: deployWithDocker2 } = await Promise.resolve().then(() => (init_deploy_docker(), exports_deploy_docker));
  const deployResult = await deployWithDocker2(options, config);
  if (!deployResult.success) {
    task.fail(deployResult.message);
    return deployResult;
  }
  task.step("symlink", "Switching to new version...");
  const { setCurrentVersion: setCurrentVersion2 } = await Promise.resolve().then(() => (init_version(), exports_version));
  await setCurrentVersion2(appName, versionId);
  task.step("metadata", "Updating application metadata...");
  const metadataPath = join14(appDir, "app.json");
  let existingMetadata = {};
  try {
    const content = await readFile6(metadataPath, "utf-8");
    existingMetadata = JSON.parse(content);
  } catch {}
  const { writeFile: fsWriteFile } = await import("fs/promises");
  const user = process.env.USER || "root";
  await fsWriteFile(metadataPath, JSON.stringify({
    name: appName,
    runtime: config.runtime,
    execStart: config.startCommand,
    workingDirectory: currentPath,
    user,
    port: config.port,
    domain: config.domain,
    gitRepo,
    gitBranch,
    buildSteps: config.buildSteps,
    database: config.database,
    cache: config.cache,
    createdAt: existingMetadata.createdAt || new Date().toISOString(),
    deploymentType: "docker",
    versions: existingMetadata.versions || [],
    currentVersionId: versionId
  }, null, 2));
  try {
    task.step("proxy", "Updating reverse proxy configuration...");
    const { genCaddyFile: genCaddyFile2 } = await Promise.resolve().then(() => (init_genCaddyFile(), exports_genCaddyFile));
    await genCaddyFile2();
  } catch (e) {
    log(`Failed to update Caddy: ${e instanceof Error ? e.message : String(e)}`);
  }
  task.success(`Successfully deployed ${appName} (v${versionId})`);
  return {
    success: true,
    message: `Successfully deployed ${appName} (v${versionId}) with Docker`,
    config
  };
}
async function checkPortAvailability(port, myAppName, log) {
  try {
    const check = await runCommand("ss", ["-ltn", `sport = :${port}`]);
    const isListening = check.stdout.includes(`:${port}`);
    if (!isListening) {
      return await checkRegistryConflict(port, myAppName);
    }
    try {
      const { containerStatus: containerStatus2 } = await Promise.resolve().then(() => (init_docker(), exports_docker));
      const status = await containerStatus2(myAppName);
      if (status.running) {
        const { listContainers: listContainers2 } = await Promise.resolve().then(() => (init_docker(), exports_docker));
        const containers = await listContainers2();
        const myContainer = containers.find((c) => c.name === myAppName);
        if (myContainer && myContainer.ports.includes(`:${port}`)) {
          log(`Port ${port} is currently held by a running instance of this app. It will be released during deployment.`);
          return;
        }
      }
    } catch (e) {}
    await checkRegistryConflict(port, myAppName);
    throw new Error(`Port ${port} is occupied by an external process or another service. Please free the port before deploying.`);
  } catch (e) {
    if (e.message.includes("occupied") || e.message.includes("already registered"))
      throw e;
    await checkRegistryConflict(port, myAppName);
  }
}
async function checkRegistryConflict(port, myAppName) {
  try {
    const apps = await readdir(APPS_DIR4);
    for (const app of apps) {
      if (app === myAppName)
        continue;
      const metaPath = join14(APPS_DIR4, app, "app.json");
      try {
        const content = await readFile6(metaPath, "utf-8");
        const meta = JSON.parse(content);
        const metaPort = meta.networking?.port || meta.port;
        if (metaPort === port) {
          throw new Error(`Port ${port} is already registered to application '${app}'`);
        }
      } catch (e) {}
    }
  } catch (e) {
    if (e.message.includes("already registered"))
      throw e;
  }
}
var APPS_DIR4;
var init_deploy_core = __esm(() => {
  init_config();
  init_command();
  init_cli_logger();
  APPS_DIR4 = join14(OKASTR8_HOME, "apps");
});

// src/utils/deploymentLogger.ts
var exports_deploymentLogger = {};
__export(exports_deploymentLogger, {
  subscribe: () => subscribe,
  streamLog: () => streamLog,
  startDeploymentStream: () => startDeploymentStream,
  getActiveStreamCount: () => getActiveStreamCount,
  endDeploymentStream: () => endDeploymentStream,
  cleanupOldStreams: () => cleanupOldStreams
});
function startDeploymentStream(deploymentId) {
  deploymentStreams.set(deploymentId, {
    id: deploymentId,
    callbacks: new Set,
    createdAt: Date.now()
  });
  console.log(`[DeploymentLogger] Started stream: ${deploymentId}`);
}
function streamLog(deploymentId, message) {
  const stream = deploymentStreams.get(deploymentId);
  if (stream) {
    stream.callbacks.forEach((callback) => {
      try {
        callback(message);
      } catch (error) {
        console.error(`[DeploymentLogger] Callback error:`, error);
      }
    });
  }
  console.log(message);
}
function subscribe(deploymentId, callback) {
  const stream = deploymentStreams.get(deploymentId);
  if (!stream) {
    console.warn(`[DeploymentLogger] Stream not found: ${deploymentId}`);
    return () => {};
  }
  stream.callbacks.add(callback);
  console.log(`[DeploymentLogger] Client subscribed to: ${deploymentId}`);
  return () => {
    stream.callbacks.delete(callback);
    console.log(`[DeploymentLogger] Client unsubscribed from: ${deploymentId}`);
  };
}
function endDeploymentStream(deploymentId) {
  const stream = deploymentStreams.get(deploymentId);
  if (stream) {
    stream.callbacks.forEach((callback) => {
      try {
        callback("[DEPLOYMENT_STREAM_END]");
      } catch (error) {
        console.error(`[DeploymentLogger] End callback error:`, error);
      }
    });
    deploymentStreams.delete(deploymentId);
    console.log(`[DeploymentLogger] Ended stream: ${deploymentId}`);
  }
}
function cleanupOldStreams() {
  const now = Date.now();
  for (const [id, stream] of deploymentStreams.entries()) {
    if (now - stream.createdAt > STREAM_TIMEOUT) {
      console.log(`[DeploymentLogger] Cleaning up old stream: ${id}`);
      endDeploymentStream(id);
    }
  }
}
function getActiveStreamCount() {
  return deploymentStreams.size;
}
var deploymentStreams, STREAM_TIMEOUT;
var init_deploymentLogger = __esm(() => {
  deploymentStreams = new Map;
  STREAM_TIMEOUT = 60 * 60 * 1000;
  setInterval(cleanupOldStreams, 10 * 60 * 1000);
});

// src/commands/env.ts
var exports_env = {};
__export(exports_env, {
  scanAndSaveEnvironments: () => scanAndSaveEnvironments,
  getRuntimeInfo: () => getRuntimeInfo,
  getInstallHint: () => getInstallHint,
  formatMissingRuntimeError: () => formatMissingRuntimeError,
  detectRuntime: () => detectRuntime2,
  detectAllRuntimes: () => detectAllRuntimes,
  checkRuntimeInstalled: () => checkRuntimeInstalled
});
async function detectRuntime2(name) {
  const check = RUNTIME_CHECKS[name];
  if (!check) {
    return { installed: false };
  }
  try {
    const result = await runCommand(check.cmd, check.args);
    if (result.exitCode === 0) {
      const output = result.stdout.trim();
      const match = output.match(check.regex);
      const version = match ? match[1] : undefined;
      const whichResult = await runCommand("which", [check.cmd]);
      const path4 = whichResult.exitCode === 0 ? whichResult.stdout.trim() : undefined;
      return {
        installed: true,
        version,
        path: path4
      };
    }
  } catch (error) {}
  return { installed: false };
}
async function detectAllRuntimes() {
  const runtimes = ["node", "python", "go", "bun", "deno"];
  const results = {};
  for (const runtime of runtimes) {
    console.log(`Checking ${runtime}...`);
    results[runtime] = await detectRuntime2(runtime);
    if (results[runtime].installed) {
      console.log(`  ✅ ${runtime} ${results[runtime].version || ""} found at ${results[runtime].path || "unknown"}`);
    } else {
      console.log(`  ❌ ${runtime} not found`);
    }
  }
  return results;
}
async function checkRuntimeInstalled(name) {
  const runtimeName = name.toLowerCase();
  const config = await getSystemConfig();
  if (config.environments?.[runtimeName]?.installed) {
    return true;
  }
  const info = await detectRuntime2(runtimeName);
  return info.installed;
}
async function getRuntimeInfo(name) {
  const config = await getSystemConfig();
  if (config.environments?.[name]) {
    return config.environments[name];
  }
  return detectRuntime2(name);
}
async function scanAndSaveEnvironments() {
  console.log(`Scanning for installed runtimes...
`);
  const environments = await detectAllRuntimes();
  await saveSystemConfig({ environments });
  console.log(`
✅ Environment scan complete. Saved to system.yaml`);
  return environments;
}
function getInstallHint(runtime, distro) {
  const hints = INSTALL_HINTS[runtime];
  if (!hints)
    return "";
  const distroKey = distro?.toLowerCase() || "default";
  let hintKey = "default";
  if (distroKey.includes("fedora") || distroKey.includes("rhel") || distroKey.includes("centos")) {
    hintKey = "fedora";
  } else if (distroKey.includes("ubuntu") || distroKey.includes("debian")) {
    hintKey = "debian";
  } else if (distroKey.includes("arch")) {
    hintKey = "arch";
  }
  return hints[hintKey] ?? hints.default ?? "";
}
function formatMissingRuntimeError(runtime, distro) {
  const hint = getInstallHint(runtime, distro);
  return `
❌ Runtime '${runtime}' is required but not installed.

To install ${runtime}:
  ${hint}

After installing, run: okastr8 env scan
`.trim();
}
var RUNTIME_CHECKS, INSTALL_HINTS;
var init_env = __esm(() => {
  init_command();
  init_config();
  RUNTIME_CHECKS = {
    node: {
      cmd: "node",
      args: ["--version"],
      regex: /^v(\d+\.\d+\.\d+)/
    },
    python: {
      cmd: "python3",
      args: ["--version"],
      regex: /Python (\d+\.\d+\.\d+)/
    },
    go: {
      cmd: "go",
      args: ["version"],
      regex: /go(\d+\.\d+(?:\.\d+)?)/
    },
    bun: {
      cmd: "bun",
      args: ["--version"],
      regex: /^(\d+\.\d+\.\d+)/
    },
    deno: {
      cmd: "deno",
      args: ["--version"],
      regex: /deno (\d+\.\d+\.\d+)/
    }
  };
  INSTALL_HINTS = {
    node: {
      fedora: "sudo dnf install nodejs",
      debian: "sudo apt install nodejs",
      arch: "sudo pacman -S nodejs",
      default: "https://nodejs.org/en/download/"
    },
    python: {
      fedora: "sudo dnf install python3",
      debian: "sudo apt install python3",
      arch: "sudo pacman -S python",
      default: "https://www.python.org/downloads/"
    },
    go: {
      fedora: "sudo dnf install golang",
      debian: "sudo apt install golang-go",
      arch: "sudo pacman -S go",
      default: "https://go.dev/dl/"
    },
    bun: {
      fedora: "curl -fsSL https://bun.sh/install | bash",
      debian: "curl -fsSL https://bun.sh/install | bash",
      arch: "curl -fsSL https://bun.sh/install | bash",
      default: "https://bun.sh/"
    },
    deno: {
      fedora: "curl -fsSL https://deno.land/install.sh | sh",
      debian: "curl -fsSL https://deno.land/install.sh | sh",
      arch: "curl -fsSL https://deno.land/install.sh | sh",
      default: "https://deno.land/"
    }
  };
});

// src/commands/github.ts
var exports_github = {};
__export(exports_github, {
  saveGitHubConfig: () => saveGitHubConfig,
  listSSHKeys: () => listSSHKeys,
  listRepos: () => listRepos,
  listBranches: () => listBranches,
  importRepo: () => importRepo,
  hasOkastr8DeployKey: () => hasOkastr8DeployKey,
  getRepo: () => getRepo,
  getGitHubUser: () => getGitHubUser,
  getGitHubConfig: () => getGitHubConfig,
  getConnectionStatus: () => getConnectionStatus,
  getAuthUrl: () => getAuthUrl,
  exchangeCodeForToken: () => exchangeCodeForToken,
  ensureWebhookSecret: () => ensureWebhookSecret,
  disconnectGitHub: () => disconnectGitHub,
  createWebhook: () => createWebhook,
  createSSHKey: () => createSSHKey,
  checkRepoConfig: () => checkRepoConfig,
  checkFileExists: () => checkFileExists
});
import { join as join16, dirname as dirname5 } from "path";
import { fileURLToPath as fileURLToPath4 } from "url";
import { readFile as readFile8, mkdir as mkdir6, rm as rm3 } from "fs/promises";
import { existsSync as existsSync10 } from "fs";
import { randomBytes as randomBytes2 } from "crypto";
async function getGitHubConfig() {
  const config = await getSystemConfig();
  const gh = config.manager?.github || {};
  return {
    clientId: gh.client_id,
    clientSecret: gh.client_secret,
    accessToken: gh.access_token,
    username: gh.username,
    connectedAt: gh.connected_at
  };
}
async function saveGitHubConfig(github) {
  await saveSystemConfig({
    manager: {
      github: {
        access_token: github.accessToken,
        username: github.username,
        connected_at: github.connectedAt
      }
    }
  });
}
function getAuthUrl(clientId, callbackUrl) {
  const scopes = ["repo", "read:user", "admin:repo_hook", "admin:public_key"];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: scopes.join(" "),
    state: Math.random().toString(36).substring(7)
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}
async function exchangeCodeForToken(clientId, clientSecret, code) {
  try {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });
    const data = await response.json();
    if (data.error) {
      return { accessToken: "", error: data.error_description || data.error };
    }
    return { accessToken: data.access_token || "" };
  } catch (error) {
    return { accessToken: "", error: error.message };
  }
}
async function getGitHubUser(accessToken) {
  const response = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json"
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
  return response.json();
}
async function listSSHKeys(accessToken) {
  const response = await fetch(`${GITHUB_API}/user/keys`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json"
    }
  });
  if (!response.ok) {
    if (response.status === 404 || response.status === 403) {
      throw new Error(`OAuth token lacks 'admin:public_key' permission.

Your GitHub token can authenticate but cannot manage SSH keys.

HOW TO FIX:
1. Go to: https://github.com/settings/tokens
2. Find your okastr8 token and edit it
3. Check the 'admin:public_key' scope
4. Save and reconnect okastr8 to GitHub

OR use manual workaround:
   ssh-keygen -t ed25519 -f ~/.ssh/okastr8_deploy_key -N "" -C "okastr8"
   cat ~/.ssh/okastr8_deploy_key.pub
   # Then add the key manually at: https://github.com/settings/keys`);
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
async function hasOkastr8DeployKey(accessToken) {
  const keys = await listSSHKeys(accessToken);
  return keys.some((k) => k.title?.includes("okastr8") || k.title?.includes("Okastr8"));
}
async function createSSHKey(accessToken, title, publicKey) {
  try {
    const response = await fetch(`${GITHUB_API}/user/keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title,
        key: publicKey
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.errors?.some((e) => e.message?.includes("already in use"))) {
        return { success: true, message: "SSH key already added to GitHub" };
      }
      return { success: false, message: errorData.message || response.statusText };
    }
    return { success: true, message: "SSH key added to GitHub successfully!" };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
async function listRepos(accessToken) {
  const repos = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const response = await fetch(`${GITHUB_API}/user/repos?per_page=${perPage}&page=${page}&sort=pushed&affiliation=owner,collaborator`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.length === 0)
      break;
    repos.push(...data);
    if (data.length < perPage)
      break;
    page++;
  }
  return repos;
}
async function getRepo(accessToken, fullName) {
  const response = await fetch(`${GITHUB_API}/repos/${fullName}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json"
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }
  return await response.json();
}
async function checkFileExists(accessToken, fullName, filePath, branch = "main") {
  try {
    const response = await fetch(`${GITHUB_API}/repos/${fullName}/contents/${filePath}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}
async function listBranches(accessToken, fullName) {
  const branches = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const response = await fetch(`${GITHUB_API}/repos/${fullName}/branches?per_page=${perPage}&page=${page}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch branches: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.length === 0)
      break;
    branches.push(...data.map((b) => b.name));
    if (data.length < perPage)
      break;
    page++;
  }
  return branches;
}
async function checkRepoConfig(accessToken, fullName, ref) {
  const files = ["okastr8.yaml", "okastr8.yml", "okastr8.json"];
  for (const file of files) {
    const response = await fetch(`${GITHUB_API}/repos/${fullName}/contents/${file}?ref=${encodeURIComponent(ref)}`, {
      method: "HEAD",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (response.ok)
      return true;
  }
  return false;
}
async function importRepo(options, deploymentId) {
  const { createApp: createApp2 } = await Promise.resolve().then(() => (init_app(), exports_app));
  const { createVersion: createVersion2, setCurrentVersion: setCurrentVersion2, cleanOldVersions: cleanOldVersions2, initializeVersioning: initializeVersioning2, updateVersionStatus: updateVersionStatus2, removeVersion: removeVersion2, getVersions: getVersions2 } = await Promise.resolve().then(() => (init_version(), exports_version));
  const githubConfig = await getGitHubConfig();
  const log = (message) => {
    if (deploymentId) {
      const { streamLog: streamLog2 } = (init_deploymentLogger(), __toCommonJS(exports_deploymentLogger));
      streamLog2(deploymentId, message);
    } else {
      console.log(message);
    }
  };
  if (!githubConfig.accessToken) {
    return { success: false, message: "GitHub not connected" };
  }
  try {
    const repo = await getRepo(githubConfig.accessToken, options.repoFullName);
    const appName = options.appName || repo.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const branch = options.branch || repo.default_branch;
    log("Checking for okastr8.yaml in repository...");
    const configExists = await checkFileExists(githubConfig.accessToken, repo.full_name, "okastr8.yaml", branch);
    if (!configExists) {
      log("❌ okastr8.yaml not found in repository root");
      return {
        success: false,
        message: `Deployment blocked: okastr8.yaml not found in repository.

Please add an okastr8.yaml file to your repository root.

Example:

runtime: node
build:
  - npm install
  - npm run build
start: npm run start
port: 3000

Visit https://github.com/${repo.full_name}/new/${branch} to create the file.`,
        appName
      };
    }
    log("✅ okastr8.yaml found - proceeding with deployment");
    const appDir = join16(APPS_DIR6, appName);
    await mkdir6(appDir, { recursive: true });
    await initializeVersioning2(appName);
    log(`Preparing deployment for ${repo.full_name} (${branch})...`);
    const { versionId, releasePath } = await createVersion2(appName, "HEAD", branch);
    const cleanupFailedDeployment = async (reason) => {
      log(`\uD83E\uDDF9 Cleaning up: ${reason}`);
      try {
        const { stopContainer: stopContainer2, removeContainer: removeContainer2, composeDown: composeDown2 } = await Promise.resolve().then(() => (init_docker(), exports_docker));
        await stopContainer2(appName).catch(() => {});
        await removeContainer2(appName).catch(() => {});
        const composePath = join16(releasePath, "docker-compose.yml");
        if (existsSync10(composePath)) {
          await composeDown2(composePath, appName).catch(() => {});
        }
      } catch (e) {
        console.error("Error cleaning up Docker:", e);
      }
      try {
        await rm3(releasePath, { recursive: true, force: true });
      } catch (e) {
        console.error("Error removing release path:", e);
      }
      try {
        await removeVersion2(appName, versionId);
      } catch (e) {
        console.error("Error removing version entry:", e);
      }
      try {
        const data = await getVersions2(appName);
        if (data.versions.length === 0 && !data.current) {
          log(`No versions left. Removing ghost app directory: ${appDir}`);
          await rm3(appDir, { recursive: true, force: true });
        }
      } catch (e) {
        console.error("Error checking ghost app:", e);
      }
    };
    await updateVersionStatus2(appName, versionId, "pending", "Cloning repository");
    log(`⬇️ Cloning into release v${versionId}...`);
    const cloneUrl = repo.private ? `https://${githubConfig.accessToken}@github.com/${repo.full_name}.git` : repo.clone_url;
    const cloneResult = await runCommand("git", [
      "clone",
      "--progress",
      "--branch",
      branch,
      "--depth",
      "1",
      cloneUrl,
      releasePath
    ]);
    if (cloneResult.exitCode !== 0) {
      await updateVersionStatus2(appName, versionId, "failed", "Clone failed");
      await cleanupFailedDeployment("Clone failed");
      return { success: false, message: `Clone failed: ${cloneResult.stderr}` };
    }
    try {
      const { runCommand: runCommand2 } = await Promise.resolve().then(() => (init_command(), exports_command));
      const commitRes = await runCommand2("git", ["rev-parse", "HEAD"], releasePath);
    } catch {}
    log("Loading okastr8.yaml configuration...");
    const configPath = join16(releasePath, "okastr8.yaml");
    let detectedConfig;
    try {
      const { load: load2 } = await Promise.resolve().then(() => (init_js_yaml(), exports_js_yaml));
      const configContent = await readFile8(configPath, "utf-8");
      const config = load2(configContent);
      detectedConfig = {
        runtime: config.runtime || "custom",
        buildSteps: config.build || [],
        startCommand: config.start || "",
        port: config.port,
        domain: config.domain,
        env: config.env
      };
      log(`✅ Configuration loaded from okastr8.yaml`);
    } catch (error) {
      await updateVersionStatus2(appName, versionId, "failed", "Invalid okastr8.yaml");
      await cleanupFailedDeployment("Invalid configuration");
      return {
        success: false,
        message: `Failed to parse okastr8.yaml: ${error.message}`,
        appName
      };
    }
    await updateVersionStatus2(appName, versionId, "building", "Building application");
    const finalPort = options.port || detectedConfig.port;
    const finalDomain = options.domain || detectedConfig.domain;
    if (options.buildSteps?.length) {
      detectedConfig.buildSteps = options.buildSteps;
    }
    if (options.startCommand) {
      detectedConfig.startCommand = options.startCommand;
    }
    if (!detectedConfig.startCommand) {
      await updateVersionStatus2(appName, versionId, "failed", "No start command");
      await cleanupFailedDeployment("Missing start command");
      return {
        success: false,
        message: "No start command specified in okastr8.yaml or deployment options.",
        config: detectedConfig
      };
    }
    const supportedRuntimes = ["node", "python", "go", "bun", "deno"];
    if (supportedRuntimes.includes(detectedConfig.runtime)) {
      const { checkRuntimeInstalled: checkRuntimeInstalled2, formatMissingRuntimeError: formatMissingRuntimeError2 } = await Promise.resolve().then(() => (init_env(), exports_env));
      const isInstalled = await checkRuntimeInstalled2(detectedConfig.runtime);
      if (!isInstalled) {
        await updateVersionStatus2(appName, versionId, "failed", "Runtime missing: " + detectedConfig.runtime);
        await cleanupFailedDeployment("Runtime missing");
        return {
          success: false,
          message: formatMissingRuntimeError2(detectedConfig.runtime),
          config: detectedConfig
        };
      }
    }
    log(`Detected runtime: ${detectedConfig.runtime}`);
    log(`Build steps: ${detectedConfig.buildSteps.join(", ") || "none"}`);
    log(`▶️  Start command: ${detectedConfig.startCommand}`);
    if (detectedConfig.buildSteps.length > 0) {
      log("Running build steps...");
      for (const step of detectedConfig.buildSteps) {
        log(`  → ${step}`);
        const buildResult = await runCommand("bash", ["-c", step], releasePath);
        if (buildResult.exitCode !== 0) {
          await updateVersionStatus2(appName, versionId, "failed", "Build failed");
          await cleanupFailedDeployment("Build failed");
          return { success: false, message: `Build failed: ${step}
${buildResult.stderr}` };
        }
      }
    }
    log("Switching to new version...");
    await setCurrentVersion2(appName, versionId);
    log("Deploying with Docker...");
    const { deployFromPath: deployFromPath2 } = await Promise.resolve().then(() => (init_deploy_core(), exports_deploy_core));
    const deployResult = await deployFromPath2({
      appName,
      releasePath,
      versionId,
      gitRepo: repo.ssh_url || repo.clone_url || repo.html_url,
      gitBranch: branch,
      onProgress: log
    });
    if (!deployResult.success) {
      await updateVersionStatus2(appName, versionId, "failed", deployResult.message);
      await cleanupFailedDeployment(deployResult.message);
      return {
        success: false,
        message: deployResult.message,
        appName,
        config: detectedConfig
      };
    }
    await updateVersionStatus2(appName, versionId, "success", "Deployed");
    log("✅ Container is running successfully!");
    await cleanOldVersions2(appName);
    if (options.setupWebhook) {
      log("Setting up webhook...");
      const ghConfig = await getGitHubConfig();
      if (ghConfig.accessToken) {
        const webhookSuccess = await createWebhook(repo.full_name, ghConfig.accessToken);
        if (!webhookSuccess) {
          console.warn("⚠️ Webhook setup failed. You can create it manually.");
        }
      } else {
        console.warn("⚠️ Cannot setup webhook: No GitHub token found.");
      }
    }
    return {
      success: true,
      message: `Successfully deployed ${repo.full_name} as '${appName}' (v${versionId})`,
      appName,
      config: detectedConfig
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
async function disconnectGitHub() {
  await saveSystemConfig({
    manager: {
      github: {
        access_token: undefined,
        username: undefined,
        connected_at: undefined
      }
    }
  });
}
async function getConnectionStatus() {
  const config = await reloadSystemConfig();
  const gh = config.manager?.github || {};
  if (gh.access_token) {
    return {
      connected: true,
      username: gh.username,
      connectedAt: gh.connected_at
    };
  }
  return { connected: false };
}
async function ensureWebhookSecret() {
  const config = await getSystemConfig();
  if (config.manager?.github?.webhook_secret) {
    return config.manager.github.webhook_secret;
  }
  const secret = randomBytes2(32).toString("hex");
  await saveSystemConfig({
    manager: {
      github: { webhook_secret: secret }
    }
  });
  return secret;
}
async function createWebhook(repoFullName, accessToken) {
  try {
    const config = await getSystemConfig();
    const baseUrl = config.tunnel?.url;
    if (!baseUrl) {
      console.error("Cannot create webhook: Tunnel URL not configured in system.yaml (tunnel.url)");
      return false;
    }
    const webhookUrl = `${baseUrl}/api/github/webhook`;
    const secret = await ensureWebhookSecret();
    const hooksRes = await fetch(`${GITHUB_API}/repos/${repoFullName}/hooks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json"
      }
    });
    if (hooksRes.ok) {
      const hooks = await hooksRes.json();
      const exists = hooks.find((h) => h.config.url === webhookUrl);
      if (exists) {
        console.log("Webhook already exists");
        return true;
      }
    }
    console.log(`Creating webhook for ${webhookUrl}...`);
    const res = await fetch(`${GITHUB_API}/repos/${repoFullName}/hooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push"],
        config: {
          url: webhookUrl,
          content_type: "json",
          secret,
          insecure_ssl: "0"
        }
      })
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Failed to create webhook:", err);
      return false;
    }
    console.log("✅ Webhook created successfully");
    return true;
  } catch (e) {
    console.error("Webhook creation error:", e);
    return false;
  }
}
var __filename5, __dirname5, PROJECT_ROOT4, APPS_DIR6, GITHUB_API = "https://api.github.com";
var init_github = __esm(() => {
  init_command();
  init_config();
  init_config();
  __filename5 = fileURLToPath4(import.meta.url);
  __dirname5 = dirname5(__filename5);
  PROJECT_ROOT4 = join16(__dirname5, "..", "..");
  APPS_DIR6 = join16(OKASTR8_HOME, "apps");
});

// src/commands/app.ts
var exports_app = {};
__export(exports_app, {
  updateApp: () => updateApp,
  stopApp: () => stopApp2,
  startApp: () => startApp2,
  setAppWebhookAutoDeploy: () => setAppWebhookAutoDeploy2,
  restartApp: () => restartApp2,
  listApps: () => listApps2,
  getAppStatus: () => getAppStatus2,
  getAppMetadata: () => getAppMetadata2,
  getAppLogs: () => getAppLogs2,
  exportAppLogs: () => exportAppLogs2,
  deleteApp: () => deleteApp2,
  createApp: () => createApp2,
  addAppCommands: () => addAppCommands2
});
import { join as join17, dirname as dirname6 } from "path";
import { mkdir as mkdir7, writeFile as writeFile9, readFile as readFile9, rm as rm4, readdir as readdir3 } from "fs/promises";
import { existsSync as existsSync11 } from "fs";
import { fileURLToPath as fileURLToPath5 } from "url";
async function ensureAppDirs2(appName) {
  const appDir = join17(APPS_DIR7, appName);
  const repoDir = join17(appDir, "repo");
  const logsDir = join17(appDir, "logs");
  await mkdir7(appDir, { recursive: true });
  await mkdir7(repoDir, { recursive: true });
  await mkdir7(logsDir, { recursive: true });
  return { appDir, repoDir, logsDir };
}
async function createApp2(config) {
  try {
    const { appDir, repoDir, logsDir } = await ensureAppDirs2(config.name);
    const metadataPath = join17(appDir, "app.json");
    const metadata = {
      ...config,
      createdAt: new Date().toISOString(),
      deploymentType: "docker",
      repoDir,
      logsDir,
      versions: [],
      currentVersionId: null,
      webhookAutoDeploy: config.webhookAutoDeploy ?? true
    };
    await writeFile9(metadataPath, JSON.stringify(metadata, null, 2));
    return {
      success: true,
      appDir,
      message: "App registered. Please use deploy command or git push to start it."
    };
  } catch (error) {
    console.error(`Error creating app ${config.name}:`, error);
    throw error;
  }
}
async function deleteApp2(appName) {
  try {
    console.log(`Deleting app: ${appName}`);
    console.log(`\uD83E\uDDF9 Cleaning up Docker resources for ${appName}...`);
    await stopContainer(appName).catch(() => {});
    await removeContainer(appName).catch(() => {});
    const currentComposePath = join17(APPS_DIR7, appName, "current", "docker-compose.yml");
    if (existsSync11(currentComposePath)) {
      const { composeDown: composeDown2 } = await Promise.resolve().then(() => (init_docker(), exports_docker));
      await composeDown2(currentComposePath, appName).catch(() => {});
    }
    const appDir = join17(APPS_DIR7, appName);
    console.log(`Removing app directory: ${appDir}`);
    await rm4(appDir, { recursive: true, force: true });
    return {
      success: true,
      message: `App '${appName}' deleted successfully`
    };
  } catch (error) {
    console.error(`Error deleting app ${appName}:`, error);
    const appDir = join17(APPS_DIR7, appName);
    await rm4(appDir, { recursive: true, force: true }).catch(() => {});
    return {
      success: false,
      message: `Failed to delete app cleanly: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
async function listApps2() {
  try {
    await mkdir7(APPS_DIR7, { recursive: true });
    const entries = await readdir3(APPS_DIR7, { withFileTypes: true });
    const apps = [];
    const runningContainers = await listContainers();
    const runningMap = new Map(runningContainers.map((c) => [c.name, c.state]));
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metadataPath = join17(APPS_DIR7, entry.name, "app.json");
        try {
          const metadata = JSON.parse(await readFile9(metadataPath, "utf-8"));
          const state = runningMap.get(entry.name);
          apps.push({
            ...metadata,
            running: state === "running",
            status: state || "stopped"
          });
        } catch {
          apps.push({ name: entry.name, status: "unknown" });
        }
      }
    }
    return { success: true, apps };
  } catch (error) {
    console.error("Error listing apps:", error);
    throw error;
  }
}
async function getAppStatus2(appName) {
  try {
    const status = await containerStatus(appName);
    return {
      success: status.status !== "not found" && status.running,
      message: status.status,
      details: status
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error checking status" };
  }
}
async function getAppLogs2(appName, lines = 50) {
  try {
    const logs = await containerLogs(appName, lines);
    return {
      success: true,
      logs
    };
  } catch (e) {
    return { success: false, logs: "Failed to retrieve logs", error: e };
  }
}
async function exportAppLogs2(appName) {
  try {
    const appDir = join17(APPS_DIR7, appName);
    const logsDir = join17(appDir, "logs");
    await mkdir7(logsDir, { recursive: true });
    const timestamp2 = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = join17(logsDir, `${appName}-${timestamp2}.log`);
    const logs = await containerLogs(appName, 1e4);
    await writeFile9(logFile, logs);
    return { success: true, logFile, message: `Logs exported to ${logFile}` };
  } catch (error) {
    console.error(`Error exporting logs for ${appName}:`, error);
    throw error;
  }
}
async function startApp2(appName) {
  try {
    await runCommand("sudo", ["docker", "start", appName]);
    return { success: true, message: "Container started" };
  } catch (e) {
    return { success: false, message: "Failed to start container: " + e };
  }
}
async function stopApp2(appName) {
  try {
    await stopContainer(appName);
    return { success: true, message: "App stopped" };
  } catch (e) {
    return { success: false, message: "Failed to stop: " + e };
  }
}
async function restartApp2(appName) {
  try {
    await restartContainer(appName);
    return { success: true, message: "App restarted" };
  } catch (e) {
    return { success: false, message: "Failed to restart: " + e };
  }
}
async function getAppMetadata2(appName) {
  const appDir = join17(APPS_DIR7, appName);
  const metadataPath = join17(appDir, "app.json");
  try {
    const content = await readFile9(metadataPath, "utf-8");
    return JSON.parse(content);
  } catch {
    throw new Error(`App ${appName} not found or corrupted`);
  }
}
async function updateApp(appName) {
  let versionId = 0;
  let releasePath = "";
  try {
    const metadata = await getAppMetadata2(appName);
    if (!metadata.gitRepo) {
      throw new Error("Not a git-linked application (missing gitRepo)");
    }
    console.log(`Updating ${appName} from git...`);
    const branch = metadata.gitBranch || "main";
    const versionResult = await createVersion(appName, "HEAD", branch);
    versionId = versionResult.versionId;
    releasePath = versionResult.releasePath;
    console.log(`Created release v${versionId} at ${releasePath}`);
    let cloneUrl = metadata.gitRepo;
    if (cloneUrl.startsWith("https://github.com/")) {
      const { getGitHubConfig: getGitHubConfig2 } = await Promise.resolve().then(() => (init_github(), exports_github));
      const ghConfig = await getGitHubConfig2();
      if (ghConfig.accessToken) {
        cloneUrl = cloneUrl.replace("https://github.com/", `https://${ghConfig.accessToken}@github.com/`);
      }
    }
    console.log(`Cloning ${branch} into release...`);
    const cloneResult = await runCommand("git", [
      "clone",
      "--depth",
      "1",
      "--branch",
      branch,
      cloneUrl,
      releasePath
    ]);
    if (cloneResult.exitCode !== 0) {
      throw new Error(`Clone failed: ${cloneResult.stderr}`);
    }
    console.log(`Deploying v${versionId}...`);
    const deployResult = await deployFromPath({
      appName,
      releasePath,
      versionId,
      gitRepo: metadata.gitRepo,
      gitBranch: branch,
      onProgress: (msg) => console.log(msg)
    });
    if (!deployResult.success) {
      console.log("Deployment failed. Cleaning up...");
      await rm4(releasePath, { recursive: true, force: true });
      await removeVersion(appName, versionId);
      throw new Error(deployResult.message);
    }
    return { success: true, message: `App updated to v${versionId}` };
  } catch (error) {
    console.error(`Error updating app ${appName}:`, error);
    if (versionId && releasePath) {
      try {
        await rm4(releasePath, { recursive: true, force: true });
        await removeVersion(appName, versionId);
      } catch {}
    }
    throw error;
  }
}
async function setAppWebhookAutoDeploy2(appName, enabled) {
  const appDir = join17(APPS_DIR7, appName);
  const metadataPath = join17(appDir, "app.json");
  try {
    const content = await readFile9(metadataPath, "utf-8");
    const metadata = JSON.parse(content);
    metadata.webhookAutoDeploy = enabled;
    await writeFile9(metadataPath, JSON.stringify(metadata, null, 2));
    return { success: true, message: `Webhook auto-deploy ${enabled ? "enabled" : "disabled"} for ${appName}` };
  } catch {
    throw new Error(`App ${appName} not found or corrupted`);
  }
}
function addAppCommands2(program2) {
  const app = program2.command("app").description("Manage okastr8 applications");
  app.command("create").description("Create a new application").argument("<name>", "Application name").argument("<exec_start>", "Command to run (e.g., 'bun run start')").option("-d, --description <desc>", "Service description", "Okastr8 managed app").option("-u, --user <user>", "User to run as", process.env.USER || "root").option("-w, --working-dir <dir>", "Working directory").option("-p, --port <port>", "Application port").option("--domain <domain>", "Domain for Caddy reverse proxy").option("--git-repo <url>", "Git repository URL").option("--git-branch <branch>", "Git branch to track", "main").option("--database <type:version>", "Database service (e.g., 'postgres:15')").option("--cache <type:version>", "Cache service (e.g., 'redis:7')").action(async (name, execStart, options) => {
    console.log(`Creating app '${name}'...`);
    try {
      const result = await createApp2({
        name,
        description: options.description,
        execStart,
        workingDirectory: options.workingDir || "",
        user: options.user,
        port: options.port ? parseInt(options.port, 10) : undefined,
        domain: options.domain,
        gitRepo: options.gitRepo,
        gitBranch: options.gitBranch,
        database: options.database,
        cache: options.cache
      });
      console.log(result.message);
      console.log(`App created at ${result.appDir}`);
    } catch (error) {
      console.error(`Failed to create app:`, error.message);
      process.exit(1);
    }
  });
  app.command("delete").description("Delete an application").argument("<name>", "Application name").action(async (name) => {
    console.log(`Deleting app '${name}'...`);
    try {
      const result = await deleteApp2(name);
      console.log(result.message);
      console.log(`App '${name}' deleted`);
    } catch (error) {
      console.error(`Failed to delete app:`, error.message);
      process.exit(1);
    }
  });
  app.command("list").description("List all okastr8 applications").action(async () => {
    try {
      const result = await listApps2();
      if (result.apps.length === 0) {
        console.log("No apps found.");
      } else {
        console.log("Okastr8 Apps:");
        for (const app2 of result.apps) {
          console.log(`  • ${app2.name}${app2.description ? ` - ${app2.description}` : ""}`);
        }
      }
    } catch (error) {
      console.error(`Failed to list apps:`, error.message);
      process.exit(1);
    }
  });
  app.command("status").description("Show status of an application").argument("<name>", "Application name").action(async (name) => {
    try {
      const result = await getAppStatus2(name);
      console.log(result.message);
    } catch (error) {
      console.error(`Failed to get status:`, error.message);
      process.exit(1);
    }
  });
  app.command("logs").description("Show logs for an application").argument("<name>", "Application name").option("-n, --lines <lines>", "Number of lines to show", "50").action(async (name, options) => {
    try {
      const result = await getAppLogs2(name, parseInt(options.lines, 10));
      console.log(result.logs);
    } catch (error) {
      console.error(`Failed to get logs:`, error.message);
      process.exit(1);
    }
  });
  app.command("export-logs").description("Export logs to app directory").argument("<name>", "Application name").action(async (name) => {
    try {
      const result = await exportAppLogs2(name);
      console.log(result.message);
    } catch (error) {
      console.error(`Failed to export logs:`, error.message);
      process.exit(1);
    }
  });
  app.command("start").description("Start an application").argument("<name>", "Application name").action(async (name) => {
    console.log(`Starting ${name}...`);
    const result = await startApp2(name);
    console.log(result.message);
  });
  const env = app.command("env").description("Manage environment variables for an app");
  env.command("set").description("Set environment variables for an app").argument("<appName>", "Name of the app").argument("<key=value...>", "Environment variables in KEY=VALUE format").action(async (appName, keyValues) => {
    try {
      const { setEnvVar: setEnvVar2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      for (const pair of keyValues) {
        const [key, ...valueParts] = pair.split("=");
        if (!key || valueParts.length === 0) {
          console.error(`Invalid format: ${pair}. Expected KEY=VALUE`);
          process.exit(1);
        }
        const value = valueParts.join("=");
        await setEnvVar2(appName, key, value);
        console.log(`Set ${key}`);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });
  env.command("import").description("Import environment variables from a .env file").argument("<appName>", "Name of the app").option("-f, --file <path>", "Path to .env file", ".env").action(async (appName, options) => {
    try {
      const { importEnvFile: importEnvFile2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      await importEnvFile2(appName, options.file);
      console.log(`✅ Imported environment variables from ${options.file}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  env.command("list").description("List environment variable keys for an app").argument("<appName>", "Name of the app").action(async (appName) => {
    try {
      const { listEnvVars: listEnvVars2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      const keys = await listEnvVars2(appName);
      if (keys.length === 0) {
        console.log("No environment variables set");
      } else {
        console.log("Environment variables:");
        keys.forEach((key) => console.log(`  ${key}=••••••••`));
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  env.command("export").description("Export environment variables to a file").argument("<appName>", "Name of the app").option("-f, --file <path>", "Output file path", "exported.env").action(async (appName, options) => {
    try {
      const { exportEnvFile: exportEnvFile2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      await exportEnvFile2(appName, options.file);
      console.log(`✅ Exported environment variables to ${options.file}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  env.command("unset").description("Unset an environment variable").argument("<appName>", "Name of the app").argument("<key>", "Environment variable key to unset").action(async (appName, key) => {
    try {
      const { unsetEnvVar: unsetEnvVar2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      await unsetEnvVar2(appName, key);
      console.log(`✅ Unset ${key}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  app.command("stop").description("Stop an application").argument("<name>", "Application name").action(async (name) => {
    console.log(`⏹️  Stopping ${name}...`);
    const result = await stopApp2(name);
    console.log(result.message);
  });
  app.command("restart").description("Restart an application").argument("<name>", "Application name").action(async (name) => {
    console.log(`Restarting ${name}...`);
    const result = await restartApp2(name);
    console.log(result.message);
  });
  app.command("webhook").description("Show or set auto-deploy webhook status for an app").argument("<name>", "Application name").argument("[state]", "State (enable/disable, on/off) - omit to show current status").action(async (name, state) => {
    try {
      if (!state) {
        const config = await getAppMetadata2(name);
        const enabled = config?.webhookAutoDeploy ?? true;
        console.log(`Webhook auto-deploy for ${name}: ${enabled ? "ENABLED" : "DISABLED"}`);
      } else {
        const enabled = ["enable", "on", "true", "1"].includes(state.toLowerCase());
        console.log(`${enabled ? "Enabling" : "Disabling"} webhooks for ${name}...`);
        const result = await setAppWebhookAutoDeploy2(name, enabled);
        console.log(result.message);
      }
    } catch (error) {
      console.error(`❌ Failed:`, error.message);
      process.exit(1);
    }
  });
}
var __filename6, __dirname6, PROJECT_ROOT5, APPS_DIR7;
var init_app = __esm(() => {
  init_command();
  init_deploy_core();
  init_version();
  init_docker();
  init_config();
  __filename6 = fileURLToPath5(import.meta.url);
  __dirname6 = dirname6(__filename6);
  PROJECT_ROOT5 = join17(__dirname6, "..", "..");
  APPS_DIR7 = join17(OKASTR8_HOME, "apps");
});

// src/services/email.ts
var exports_email = {};
__export(exports_email, {
  testEmailConfig: () => testEmailConfig,
  sendWelcomeEmail: () => sendWelcomeEmail,
  sendServiceDownEmail: () => sendServiceDownEmail,
  sendLoginApprovalEmail: () => sendLoginApprovalEmail,
  sendEmail: () => sendEmail,
  sendDeploymentAlertEmail: () => sendDeploymentAlertEmail,
  sendAdminEmail: () => sendAdminEmail
});
import { join as join18 } from "path";
import { homedir as homedir4 } from "os";
import { existsSync as existsSync12 } from "fs";
import { readFile as readFile10 } from "fs/promises";
async function getBrevoConfig() {
  try {
    if (!existsSync12(SYSTEM_YAML_PATH)) {
      console.error("Email: system.yaml not found");
      return null;
    }
    const content = await readFile10(SYSTEM_YAML_PATH, "utf-8");
    const config = import_yaml.parse(content);
    const brevo = config?.notifications?.brevo;
    if (!brevo?.api_key) {
      console.error("Email: Brevo config not found in system.yaml");
      return null;
    }
    return {
      apiKey: brevo.api_key,
      senderEmail: brevo.sender_email || "robot@makumitech.co.ke",
      senderName: brevo.sender_name || "okastr8",
      adminEmail: brevo.admin_email || ""
    };
  } catch (error) {
    console.error("Email: Failed to load config:", error.message);
    return null;
  }
}
async function sendEmail(options) {
  const config = await getBrevoConfig();
  if (!config) {
    return { success: false, error: "Email not configured. Add brevo config to system.yaml" };
  }
  const mailOptions = {
    sender: {
      name: config.senderName,
      email: config.senderEmail
    },
    to: [{ email: options.to }],
    subject: options.subject,
    htmlContent: options.html,
    textContent: options.text
  };
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
        Accept: "application/json"
      },
      body: JSON.stringify(mailOptions)
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Email send failed:", errorData);
      return { success: false, error: errorData.message || "Failed to send email" };
    }
    const result = await response.json();
    console.log("Email sent successfully:", result.messageId);
    return { success: true };
  } catch (error) {
    console.error("Email error:", error.message);
    return { success: false, error: error.message };
  }
}
async function sendAdminEmail(subject, html) {
  const config = await getBrevoConfig();
  if (!config?.adminEmail) {
    return { success: false, error: "Admin email not configured in system.yaml" };
  }
  return sendEmail({
    to: config.adminEmail,
    subject: `[okastr8] ${subject}`,
    html
  });
}
async function sendLoginApprovalEmail(userEmail, requestId, requestTime) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8B5CF6, #6366F1); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
        .user-badge { background: #E0E7FF; color: #4338CA; padding: 4px 12px; border-radius: 20px; font-weight: 500; }
        .request-id { font-family: monospace; background: #f3f4f6; padding: 8px 12px; border-radius: 4px; }
        .actions { margin-top: 20px; }
        .action-btn { display: inline-block; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-right: 10px; }
        .approve { background: #10B981; color: white; }
        .reject { background: #EF4444; color: white; }
        .cli-cmd { background: #1f2937; color: #10B981; padding: 12px 16px; border-radius: 6px; font-family: monospace; margin-top: 16px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">\uD83D\uDD10 Login Approval Request</h2>
        </div>
        <div class="content">
            <p>A user is requesting access to okastr8:</p>
            
            <p><strong>User:</strong> <span class="user-badge">${userEmail}</span></p>
            <p><strong>Time:</strong> ${requestTime}</p>
            <p><strong>Request ID:</strong> <span class="request-id">${requestId.slice(0, 8)}...</span></p>
            
            <p>To approve or reject, run one of these commands:</p>
            
            <div class="cli-cmd">
                okastr8 auth approve ${requestId.slice(0, 8)}<br>
                okastr8 auth reject ${requestId.slice(0, 8)}
            </div>
            
            <p class="footer">
                This request will expire in 5 minutes if not approved.<br>
                If you didn't expect this request, you can safely ignore it.
            </p>
        </div>
    </div>
</body>
</html>`;
  return sendAdminEmail("Login Approval Requested", html);
}
async function sendDeploymentAlertEmail(appName, status, details) {
  const statusEmoji = status === "success" ? "✅" : "❌";
  const statusColor = status === "success" ? "#10B981" : "#EF4444";
  const statusText = status === "success" ? "Successful" : "Failed";
  const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
        .app-name { font-family: monospace; background: #e5e7eb; padding: 4px 8px; border-radius: 4px; }
        .details { background: #1f2937; color: #d1d5db; padding: 12px 16px; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">${statusEmoji} Deployment ${statusText}</h2>
        </div>
        <div class="content">
            <p><strong>Application:</strong> <span class="app-name">${appName}</span></p>
            <p><strong>Status:</strong> ${statusText}</p>
            <p><strong>Details:</strong></p>
            <div class="details">${details}</div>
        </div>
    </div>
</body>
</html>`;
  return sendAdminEmail(`Deployment ${statusText}: ${appName}`, html);
}
async function sendServiceDownEmail(serviceName, error) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #EF4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
        .service-name { font-family: monospace; background: #FEE2E2; color: #DC2626; padding: 4px 8px; border-radius: 4px; }
        .error { background: #1f2937; color: #FCA5A5; padding: 12px 16px; border-radius: 6px; font-family: monospace; }
        .cli-cmd { background: #1f2937; color: #10B981; padding: 12px 16px; border-radius: 6px; font-family: monospace; margin-top: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">\uD83D\uDEA8 Service Down Alert</h2>
        </div>
        <div class="content">
            <p><strong>Service:</strong> <span class="service-name">${serviceName}</span></p>
            <p><strong>Error:</strong></p>
            <div class="error">${error}</div>
            <p>To restart the service:</p>
            <div class="cli-cmd">okastr8 service restart ${serviceName}</div>
        </div>
    </div>
</body>
</html>`;
  return sendAdminEmail(`Service Down: ${serviceName}`, html);
}
async function testEmailConfig() {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8B5CF6, #6366F1); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">✅ Email Configuration Test</h2>
        </div>
        <div class="content">
            <p style="font-size: 18px;">Your okastr8 email notifications are working!</p>
            <p>You will receive alerts for:</p>
            <ul style="text-align: left;">
                <li>Login approval requests</li>
                <li>Deployment status</li>
                <li>Service down alerts</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
  return sendAdminEmail("Email Configuration Test", html);
}
async function sendWelcomeEmail(userEmail, token, permissions) {
  const config = await getBrevoConfig();
  if (!config) {
    return { success: false, error: "Email not configured" };
  }
  const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #8B5CF6, #6366F1); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
        .token-box { background: #1f2937; color: #10B981; padding: 16px; border-radius: 6px; font-family: monospace; word-break: break-all; margin: 20px 0; font-size: 14px; }
        .permissions { display: inline-block; background: #E0E7FF; color: #4338CA; padding: 4px 8px; border-radius: 4px; font-size: 13px; margin-right: 4px; margin-bottom: 4px; }
        .footer { margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">\uD83D\uDC4B Welcome to okastr8</h2>
        </div>
        <div class="content">
            <p>You have been granted access to the okastr8 dashboard.</p>
            
            <p><strong>Your Gateway Token:</strong></p>
            <div class="token-box">${token}</div>
            
            <p><strong>Your Permissions:</strong></p>
            <div>
                ${permissions.map((p) => `<span class="permissions">${p}</span>`).join("")}
            </div>
            
            <p style="margin-top: 20px;">
                <strong>How to login:</strong><br>
                1. Go to your dashboard URL<br>
                2. Paste the token above<br>
                3. Wait for admin approval (if enabled)
            </p>
            
            <p class="footer">
                Keep this token safe! It is your only way to access the system.
            </p>
        </div>
    </div>
</body>
</html>`;
  return sendEmail({
    to: userEmail,
    subject: "[okastr8] Your Access Token",
    html
  });
}
var import_yaml, SYSTEM_YAML_PATH;
var init_email = __esm(() => {
  import_yaml = __toESM(require_dist(), 1);
  SYSTEM_YAML_PATH = join18(homedir4(), ".okastr8", "system.yaml");
});

// node_modules/commander/esm.mjs
var import__ = __toESM(require_commander(), 1);
var {
  program,
  createCommand,
  createArgument,
  createOption,
  CommanderError,
  InvalidArgumentError,
  InvalidOptionArgumentError,
  Command,
  Argument,
  Option,
  Help
} = import__.default;

// src/commands/systemd.ts
init_command();
import * as path from "path";
var SCRIPT_BASE_PATH = path.join(process.cwd(), "scripts", "systemd");
async function createService(service_name, description, exec_start, working_directory, user, wanted_by, auto_start) {
  return await runCommand("sudo", [
    path.join(SCRIPT_BASE_PATH, "create.sh"),
    service_name,
    description,
    exec_start,
    working_directory,
    user,
    wanted_by,
    auto_start ? "true" : "false"
  ]);
}
async function deleteService(service_name) {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "delete.sh"), service_name]);
}
async function startService(service_name) {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "start.sh"), service_name]);
}
async function stopService(service_name) {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "stop.sh"), service_name]);
}
async function restartService(service_name) {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "restart.sh"), service_name]);
}
async function statusService(service_name) {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "status.sh"), service_name]);
}
async function logsService(service_name) {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "logs.sh"), service_name]);
}
async function enableService(service_name) {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "enable.sh"), service_name]);
}
async function disableService(service_name) {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "disable.sh"), service_name]);
}
async function reloadDaemon() {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "reload.sh")]);
}
async function listServices() {
  return await runCommand("sudo", [path.join(SCRIPT_BASE_PATH, "list.sh")]);
}
function addSystemdCommands(program2) {
  const systemd = program2.command("systemd").description("Manage systemd services");
  systemd.command("create").description("Create a systemd service unit file").argument("<service_name>", "Name of the service").argument("<description>", "Description of the service").argument("<exec_start>", "Command to execute").argument("<working_directory>", "Working directory for the service").argument("<user>", "User to run the service as").argument("<wanted_by>", "Target to be wanted by (e.g., multi-user.target)").option("-a, --auto-start <boolean>", "Whether to enable and start the service automatically (default: true)", "true").action(async (service_name, description, exec_start, working_directory, user, wanted_by, options) => {
    const result = await createService(service_name, description, exec_start, working_directory, user, wanted_by, options.autoStart === "true");
    console.log(result.stdout || result.stderr);
  });
  systemd.command("delete").description("Delete a systemd service unit file").argument("<service_name>", "Name of the service to delete").action(async (service_name) => {
    const result = await deleteService(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("start").description("Start a systemd service").argument("<service_name>", "Name of the service to start").action(async (service_name) => {
    const result = await startService(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("stop").description("Stop a systemd service").argument("<service_name>", "Name of the service to stop").action(async (service_name) => {
    const result = await stopService(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("restart").description("Restart a systemd service").argument("<service_name>", "Name of the service to restart").action(async (service_name) => {
    const result = await restartService(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("status").description("Show the status of a systemd service").argument("<service_name>", "Name of the service to check status").action(async (service_name) => {
    const result = await statusService(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("logs").description("Show the last 50 log lines for a systemd service").argument("<service_name>", "Name of the service to show logs for").action(async (service_name) => {
    const result = await logsService(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("enable").description("Enable a systemd service").argument("<service_name>", "Name of the service to enable").action(async (service_name) => {
    const result = await enableService(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("disable").description("Disable a systemd service").argument("<service_name>", "Name of the service to disable").action(async (service_name) => {
    const result = await disableService(service_name);
    console.log(result.stdout || result.stderr);
  });
  systemd.command("reload").description("Reload the systemd daemon").action(async () => {
    const result = await reloadDaemon();
    console.log(result.stdout || result.stderr);
  });
  systemd.command("list").description("List all okastr8 systemd service files").action(async () => {
    const result = await listServices();
    console.log(result.stdout || result.stderr);
  });
}

// src/commands/user.ts
init_command();
init_auth();
import * as path2 from "path";
import { userInfo } from "os";
var SCRIPT_BASE_PATH2 = path2.join(process.cwd(), "scripts", "user");
async function createUser(username, password, distro) {
  return await runCommand("sudo", [path2.join(SCRIPT_BASE_PATH2, "create-user.sh"), username, password || username, distro || ""]);
}
async function deleteUser(username) {
  return await runCommand("sudo", [path2.join(SCRIPT_BASE_PATH2, "delete-user.sh"), username]);
}
async function getLastLogin(username) {
  return await runCommand(path2.join(SCRIPT_BASE_PATH2, "lastLogin.sh"), [username]);
}
async function listGroups(username) {
  return await runCommand(path2.join(SCRIPT_BASE_PATH2, "listGroups.sh"), [username]);
}
async function listUsers2() {
  return await runCommand("sudo", [path2.join(SCRIPT_BASE_PATH2, "listUsers.sh")]);
}
async function lockUser(username) {
  return await runCommand("sudo", [path2.join(SCRIPT_BASE_PATH2, "lockUser.sh"), username]);
}
async function unlockUser(username) {
  return await runCommand("sudo", [path2.join(SCRIPT_BASE_PATH2, "unlockUser.sh"), username]);
}
function addUserCommands(program2) {
  const user = program2.command("user").description("Manage system users");
  user.command("create").description("Create a new system user").argument("[username]", "Username for the new user").argument("[password]", "Password for the new user").option("-d, --distro <distro>", "Distribution type (fedora or debian)").action(async (usernameArg, passwordArg, options) => {
    const enquirer = await Promise.resolve().then(() => __toESM(require_enquirer(), 1));
    const Input = enquirer.Input || enquirer.default?.Input;
    const Password = enquirer.Password || enquirer.default?.Password;
    let username = usernameArg;
    let password = passwordArg;
    if (!username) {
      const prompt = new Input({
        name: "username",
        message: "Enter username for the new user:"
      });
      username = await prompt.run();
    }
    if (!username) {
      console.error("❌ Username is required.");
      return;
    }
    if (!password) {
      const prompt = new Password({
        name: "password",
        message: "Enter password (leave empty to use username):"
      });
      password = await prompt.run();
    }
    if (!password) {
      password = username;
      console.log(`No password provided, using username '${username}' as password.`);
    }
    console.log(`
Creating user '${username}'...`);
    const result = await createUser(username, password, options.distro);
    console.log(result.stdout || result.stderr);
  });
  user.command("delete").description("Delete a system user").argument("<username>", "Username of the user to delete").action(async (username) => {
    const result = await deleteUser(username);
    console.log(result.stdout || result.stderr);
  });
  user.command("last-login").description("Show last login time for a user").argument("<username>", "Username to check last login for").action(async (username) => {
    const result = await getLastLogin(username);
    console.log(result.stdout || result.stderr);
  });
  user.command("list-groups").description("List groups for a user").argument("<username>", "Username to list groups for").action(async (username) => {
    const result = await listGroups(username);
    console.log(result.stdout || result.stderr);
  });
  user.command("list-users").description("Manage system users interactively").option("--plain", "Show plain list (non-interactive)").action(async (options) => {
    const result = await listUsers2();
    if (result.exitCode !== 0) {
      console.error(`❌ Error listing users: ${result.stderr}`);
      return;
    }
    const rawOutput = result.stdout.trim();
    if (!rawOutput) {
      console.log("No users found.");
      return;
    }
    const users = rawOutput.split(`
`).map((line) => {
      const [username, status] = line.split(":");
      return { username, status };
    });
    if (options.plain) {
      console.log(`
\uD83D\uDC65 System Users
`);
      users.forEach((u) => {
        const icon = u.status === "locked" ? "[LOCKED]" : "[ACTIVE]";
        console.log(`${icon} ${u.username} (${u.status})`);
      });
      return;
    }
    try {
      const authData = await loadAuthData();
      const adminUser = authData.admin;
      const enquirer = await Promise.resolve().then(() => __toESM(require_enquirer(), 1));
      const AutoComplete = enquirer.AutoComplete || enquirer.default?.AutoComplete;
      const Select = enquirer.Select || enquirer.default?.Select;
      const Confirm = enquirer.Confirm || enquirer.default?.Confirm;
      const prompt = new AutoComplete({
        name: "user",
        message: "Select a user to manage",
        choices: users.map((u) => {
          let icon = u.status === "locked" ? "[LOCKED]" : "[ACTIVE]";
          if (u.username === adminUser)
            icon = "[ADMIN]";
          return {
            name: u.username,
            message: `${icon} ${u.username}`
          };
        })
      });
      const selectedUsername = await prompt.run();
      const selectedUser = users.find((u) => u.username === selectedUsername);
      if (selectedUsername === adminUser) {
        console.log(`
Admin Account (${selectedUsername})`);
        console.log("   This is the main system administrator.");
        console.log(`   Actions are restricted to prevent lockout.
`);
        return;
      }
      const actionPrompt = new Select({
        name: "action",
        message: `Action for ${selectedUsername}:`,
        choices: [
          {
            name: "lock_unlock",
            message: selectedUser.status === "locked" ? "Unlock Account" : "Lock Account"
          },
          { name: "info", message: "View Details (Groups, Last Login)" },
          { name: "delete", message: "Delete User" },
          { name: "cancel", message: "↩️  Cancel" }
        ]
      });
      const action = await actionPrompt.run();
      if (action === "cancel") {
        console.log("Cancelled.");
        return;
      }
      if (action === "info") {
        console.log(`
Gathering info for ${selectedUsername}...
`);
        const login = await getLastLogin(selectedUsername);
        const groups = await listGroups(selectedUsername);
        console.log("Last Login:");
        console.log(login.stdout.trim() || "Never");
        console.log(`
Groups:`);
        console.log(groups.stdout.trim());
      }
      if (action === "lock_unlock") {
        if (selectedUser.status === "locked") {
          console.log(`Unlocking ${selectedUsername}...`);
          await unlockUser(selectedUsername);
          console.log("✅ User unlocked.");
        } else {
          const authData2 = await loadAuthData();
          const realUser = process.env.SUDO_USER || userInfo().username;
          if (selectedUsername === authData2.admin || selectedUsername === realUser) {
            console.log(`
⚠️  Security Alert: You cannot lock the admin/current user (${selectedUsername}).
`);
            return;
          }
          console.log(`Locking ${selectedUsername}...`);
          await lockUser(selectedUsername);
          console.log("✅ User locked.");
        }
      }
      if (action === "delete") {
        const authData2 = await loadAuthData();
        const realUser = process.env.SUDO_USER || userInfo().username;
        if (selectedUsername === authData2.admin || selectedUsername === realUser) {
          console.log(`
⚠️  Security Alert: You cannot delete the admin/current user (${selectedUsername}).
`);
          return;
        }
        const confirm = new Confirm({
          name: "sure",
          message: `⚠️  Are you SURE you want to DELETE user '${selectedUsername}'? This creates a backup but is destructive.`
        });
        if (await confirm.run()) {
          console.log(`Deleting ${selectedUsername}...`);
          await deleteUser(selectedUsername);
          console.log("✅ User deleted.");
        } else {
          console.log("Cancelled.");
        }
      }
    } catch (error) {
      console.log("");
    }
  });
  user.command("lock").description("Lock a user account").argument("<username>", "Username of the user to lock").action(async (username) => {
    const result = await lockUser(username);
    console.log(result.stdout || result.stderr);
  });
}

// src/utils/ochestrateEnvironment.ts
init_command();
import { join as join4 } from "path";
async function orchestrateEnvironment() {
  try {
    const pathToScript = join4(process.cwd(), "scripts", "ochestrateEnvironment.sh");
    return await runCommand(pathToScript, []);
  } catch (error) {
    console.error(`Error orchestrating environment:`, error);
    throw error;
  }
}

// src/commands/orchestrate.ts
async function orchestrateEnvironment2() {
  return await orchestrateEnvironment();
}
function addOrchestrateCommand(program2) {
  program2.command("orchestrate").description("Orchestrate the server environment using a JSON configuration file from ~/.okastr8/environment.json").action(async () => {
    const result = await orchestrateEnvironment2();
    console.log(result.stdout || result.stderr);
  });
}

// src/commands/setup.ts
init_command();
var import_enquirer = __toESM(require_enquirer(), 1);
import { join as join5, dirname } from "path";
import { fileURLToPath } from "url";
var { prompt } = import_enquirer.default;
var __filename2 = fileURLToPath(import.meta.url);
var __dirname2 = dirname(__filename2);
var PROJECT_ROOT = join5(__dirname2, "..", "..");
var SCRIPTS = {
  setup: join5(PROJECT_ROOT, "scripts", "setup.sh"),
  sudoers: join5(PROJECT_ROOT, "scripts", "setup-sudoers.sh"),
  hardenSsh: join5(PROJECT_ROOT, "scripts", "ssh", "harden-ssh.sh"),
  changeSshPort: join5(PROJECT_ROOT, "scripts", "ssh", "change-ssh-port.sh"),
  ufwDefaults: join5(PROJECT_ROOT, "scripts", "ufw", "defaults.sh"),
  fail2ban: join5(PROJECT_ROOT, "scripts", "fail2ban", "fail2ban.sh"),
  orchestrate: join5(PROJECT_ROOT, "scripts", "ochestrateEnvironment.sh"),
  createUser: join5(PROJECT_ROOT, "scripts", "user", "create-user.sh")
};
async function runFullSetup() {
  return await runCommand("sudo", [SCRIPTS.setup]);
}
async function hardenSsh(port) {
  const args = port ? [SCRIPTS.hardenSsh, port.toString()] : [SCRIPTS.hardenSsh];
  return await runCommand("sudo", args);
}
async function changeSshPort(port) {
  return await runCommand("sudo", [SCRIPTS.changeSshPort, port.toString()]);
}
async function configureFirewall(sshPort) {
  const args = sshPort ? [SCRIPTS.ufwDefaults, sshPort.toString()] : [SCRIPTS.ufwDefaults];
  return await runCommand("sudo", args);
}
async function configureFail2ban() {
  return await runCommand("sudo", [SCRIPTS.fail2ban]);
}
async function orchestrateEnvironment3() {
  return await runCommand(SCRIPTS.orchestrate, []);
}
function addSetupCommands(program2) {
  const setup = program2.command("setup").description("Server setup and hardening commands");
  setup.command("full").description("Run complete server setup (installs dependencies, configures firewall, etc)").action(async () => {
    console.log("Running full server setup...");
    const result = await runFullSetup();
    console.log(result.stdout || result.stderr);
    if (result.exitCode !== 0) {
      process.exit(result.exitCode || 1);
    }
  });
  setup.command("ssh-harden").description("Harden SSH configuration (disable password auth, root login, etc)").option("-p, --port <port>", "Optionally change SSH port").action(async (options) => {
    console.log("Hardening SSH configuration...");
    const port = options.port ? parseInt(options.port, 10) : undefined;
    const result = await hardenSsh(port);
    console.log(result.stdout || result.stderr);
    if (result.exitCode !== 0) {
      process.exit(result.exitCode || 1);
    }
  });
  setup.command("ssh-port").description("Change the SSH port").argument("<port>", "New SSH port number").action(async (port) => {
    console.log(`Changing SSH port to ${port}...`);
    const result = await changeSshPort(parseInt(port, 10));
    console.log(result.stdout || result.stderr);
    if (result.exitCode !== 0) {
      process.exit(result.exitCode || 1);
    }
  });
  setup.command("firewall").description("Configure UFW firewall with secure defaults").option("-p, --ssh-port <port>", "SSH port to allow (default: 2222)").action(async (options) => {
    console.log("Configuring firewall...");
    const sshPort = options.sshPort ? parseInt(options.sshPort, 10) : undefined;
    const result = await configureFirewall(sshPort);
    console.log(result.stdout || result.stderr);
    if (result.exitCode !== 0) {
      process.exit(result.exitCode || 1);
    }
  });
  setup.command("fail2ban").description("Configure fail2ban for DDoS/brute-force protection").action(async () => {
    console.log("Configuring fail2ban...");
    const result = await configureFail2ban();
    console.log(result.stdout || result.stderr);
    if (result.exitCode !== 0) {
      process.exit(result.exitCode || 1);
    }
  });
  setup.command("orchestrate").description("Orchestrate complete environment from ~/.okastr8/environment.json").action(async () => {
    console.log("Orchestrating environment...");
    const result = await orchestrateEnvironment3();
    console.log(result.stdout || result.stderr);
    if (result.exitCode !== 0) {
      process.exit(result.exitCode || 1);
    }
  });
  setup.command("sudoers").description("Configure passwordless sudo for all okastr8 operations (including Docker)").action(async () => {
    console.log(`Configuring sudoers for passwordless operation...
`);
    console.log("This will allow okastr8 and Docker to run without password prompts.");
    console.log(`You may be asked for your password once to apply the configuration.
`);
    const result = await runCommand("sudo", [SCRIPTS.sudoers]);
    console.log(result.stdout || result.stderr);
    if (result.exitCode === 0) {
      console.log(`
✅ Sudoers configured successfully!`);
      console.log("   Okastr8 and Docker can now run system commands without password prompts.");
      console.log("   Try running a deployment now—it should be fast and seamless.");
    } else {
      console.error(`
❌ Sudoers configuration failed.`);
      process.exit(result.exitCode || 1);
    }
  });
  setup.command("user").description("Interactively create a new non-root user with sudo and docker access").action(async () => {
    console.log(`\uD83D\uDC64 New User Setup
`);
    try {
      const response = await prompt([
        {
          type: "input",
          name: "username",
          message: "Enter username for the new user:",
          validate: (val) => val.length > 0
        },
        {
          type: "password",
          name: "password",
          message: "Enter password for the new user:",
          validate: (val) => val.length > 0
        }
      ]);
      console.log(`
Creating user '${response.username}'...`);
      const result = await runCommand("sudo", [
        SCRIPTS.createUser,
        response.username,
        response.password
      ]);
      console.log(result.stdout || result.stderr);
      if (result.exitCode === 0) {
        console.log(`
✅ User created successfully!`);
        console.log(`   You can now switch to the new user: su - ${response.username}`);
        console.log("   From there, you can run 'okastr8 setup full' to complete the installation.");
      } else {
        console.error(`
❌ Failed to create user.`);
        process.exit(1);
      }
    } catch (e) {
      console.log(`
User setup cancelled.`);
    }
  });
}

// src/commands/app.ts
init_command();
init_deploy_core();
init_version();
init_docker();
init_config();
import { join as join15, dirname as dirname4 } from "path";
import { mkdir as mkdir5, writeFile as writeFile7, readFile as readFile7, rm as rm2, readdir as readdir2 } from "fs/promises";
import { existsSync as existsSync9 } from "fs";
import { fileURLToPath as fileURLToPath3 } from "url";
var __filename4 = fileURLToPath3(import.meta.url);
var __dirname4 = dirname4(__filename4);
var PROJECT_ROOT3 = join15(__dirname4, "..", "..");
var APPS_DIR5 = join15(OKASTR8_HOME, "apps");
async function ensureAppDirs(appName) {
  const appDir = join15(APPS_DIR5, appName);
  const repoDir = join15(appDir, "repo");
  const logsDir = join15(appDir, "logs");
  await mkdir5(appDir, { recursive: true });
  await mkdir5(repoDir, { recursive: true });
  await mkdir5(logsDir, { recursive: true });
  return { appDir, repoDir, logsDir };
}
async function createApp(config) {
  try {
    const { appDir, repoDir, logsDir } = await ensureAppDirs(config.name);
    const metadataPath = join15(appDir, "app.json");
    const metadata = {
      ...config,
      createdAt: new Date().toISOString(),
      deploymentType: "docker",
      repoDir,
      logsDir,
      versions: [],
      currentVersionId: null,
      webhookAutoDeploy: config.webhookAutoDeploy ?? true
    };
    await writeFile7(metadataPath, JSON.stringify(metadata, null, 2));
    return {
      success: true,
      appDir,
      message: "App registered. Please use deploy command or git push to start it."
    };
  } catch (error) {
    console.error(`Error creating app ${config.name}:`, error);
    throw error;
  }
}
async function deleteApp(appName) {
  try {
    console.log(`Deleting app: ${appName}`);
    console.log(`\uD83E\uDDF9 Cleaning up Docker resources for ${appName}...`);
    await stopContainer(appName).catch(() => {});
    await removeContainer(appName).catch(() => {});
    const currentComposePath = join15(APPS_DIR5, appName, "current", "docker-compose.yml");
    if (existsSync9(currentComposePath)) {
      const { composeDown: composeDown2 } = await Promise.resolve().then(() => (init_docker(), exports_docker));
      await composeDown2(currentComposePath, appName).catch(() => {});
    }
    const appDir = join15(APPS_DIR5, appName);
    console.log(`Removing app directory: ${appDir}`);
    await rm2(appDir, { recursive: true, force: true });
    return {
      success: true,
      message: `App '${appName}' deleted successfully`
    };
  } catch (error) {
    console.error(`Error deleting app ${appName}:`, error);
    const appDir = join15(APPS_DIR5, appName);
    await rm2(appDir, { recursive: true, force: true }).catch(() => {});
    return {
      success: false,
      message: `Failed to delete app cleanly: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
async function listApps() {
  try {
    await mkdir5(APPS_DIR5, { recursive: true });
    const entries = await readdir2(APPS_DIR5, { withFileTypes: true });
    const apps = [];
    const runningContainers = await listContainers();
    const runningMap = new Map(runningContainers.map((c) => [c.name, c.state]));
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metadataPath = join15(APPS_DIR5, entry.name, "app.json");
        try {
          const metadata = JSON.parse(await readFile7(metadataPath, "utf-8"));
          const state = runningMap.get(entry.name);
          apps.push({
            ...metadata,
            running: state === "running",
            status: state || "stopped"
          });
        } catch {
          apps.push({ name: entry.name, status: "unknown" });
        }
      }
    }
    return { success: true, apps };
  } catch (error) {
    console.error("Error listing apps:", error);
    throw error;
  }
}
async function getAppStatus(appName) {
  try {
    const status = await containerStatus(appName);
    return {
      success: status.status !== "not found" && status.running,
      message: status.status,
      details: status
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Error checking status" };
  }
}
async function getAppLogs(appName, lines = 50) {
  try {
    const logs = await containerLogs(appName, lines);
    return {
      success: true,
      logs
    };
  } catch (e) {
    return { success: false, logs: "Failed to retrieve logs", error: e };
  }
}
async function exportAppLogs(appName) {
  try {
    const appDir = join15(APPS_DIR5, appName);
    const logsDir = join15(appDir, "logs");
    await mkdir5(logsDir, { recursive: true });
    const timestamp2 = new Date().toISOString().replace(/[:.]/g, "-");
    const logFile = join15(logsDir, `${appName}-${timestamp2}.log`);
    const logs = await containerLogs(appName, 1e4);
    await writeFile7(logFile, logs);
    return { success: true, logFile, message: `Logs exported to ${logFile}` };
  } catch (error) {
    console.error(`Error exporting logs for ${appName}:`, error);
    throw error;
  }
}
async function startApp(appName) {
  try {
    await runCommand("sudo", ["docker", "start", appName]);
    return { success: true, message: "Container started" };
  } catch (e) {
    return { success: false, message: "Failed to start container: " + e };
  }
}
async function stopApp(appName) {
  try {
    await stopContainer(appName);
    return { success: true, message: "App stopped" };
  } catch (e) {
    return { success: false, message: "Failed to stop: " + e };
  }
}
async function restartApp(appName) {
  try {
    await restartContainer(appName);
    return { success: true, message: "App restarted" };
  } catch (e) {
    return { success: false, message: "Failed to restart: " + e };
  }
}
async function getAppMetadata(appName) {
  const appDir = join15(APPS_DIR5, appName);
  const metadataPath = join15(appDir, "app.json");
  try {
    const content = await readFile7(metadataPath, "utf-8");
    return JSON.parse(content);
  } catch {
    throw new Error(`App ${appName} not found or corrupted`);
  }
}
async function setAppWebhookAutoDeploy(appName, enabled) {
  const appDir = join15(APPS_DIR5, appName);
  const metadataPath = join15(appDir, "app.json");
  try {
    const content = await readFile7(metadataPath, "utf-8");
    const metadata = JSON.parse(content);
    metadata.webhookAutoDeploy = enabled;
    await writeFile7(metadataPath, JSON.stringify(metadata, null, 2));
    return { success: true, message: `Webhook auto-deploy ${enabled ? "enabled" : "disabled"} for ${appName}` };
  } catch {
    throw new Error(`App ${appName} not found or corrupted`);
  }
}
function addAppCommands(program2) {
  const app = program2.command("app").description("Manage okastr8 applications");
  app.command("create").description("Create a new application").argument("<name>", "Application name").argument("<exec_start>", "Command to run (e.g., 'bun run start')").option("-d, --description <desc>", "Service description", "Okastr8 managed app").option("-u, --user <user>", "User to run as", process.env.USER || "root").option("-w, --working-dir <dir>", "Working directory").option("-p, --port <port>", "Application port").option("--domain <domain>", "Domain for Caddy reverse proxy").option("--git-repo <url>", "Git repository URL").option("--git-branch <branch>", "Git branch to track", "main").option("--database <type:version>", "Database service (e.g., 'postgres:15')").option("--cache <type:version>", "Cache service (e.g., 'redis:7')").action(async (name, execStart, options) => {
    console.log(`Creating app '${name}'...`);
    try {
      const result = await createApp({
        name,
        description: options.description,
        execStart,
        workingDirectory: options.workingDir || "",
        user: options.user,
        port: options.port ? parseInt(options.port, 10) : undefined,
        domain: options.domain,
        gitRepo: options.gitRepo,
        gitBranch: options.gitBranch,
        database: options.database,
        cache: options.cache
      });
      console.log(result.message);
      console.log(`App created at ${result.appDir}`);
    } catch (error) {
      console.error(`Failed to create app:`, error.message);
      process.exit(1);
    }
  });
  app.command("delete").description("Delete an application").argument("<name>", "Application name").action(async (name) => {
    console.log(`Deleting app '${name}'...`);
    try {
      const result = await deleteApp(name);
      console.log(result.message);
      console.log(`App '${name}' deleted`);
    } catch (error) {
      console.error(`Failed to delete app:`, error.message);
      process.exit(1);
    }
  });
  app.command("list").description("List all okastr8 applications").action(async () => {
    try {
      const result = await listApps();
      if (result.apps.length === 0) {
        console.log("No apps found.");
      } else {
        console.log("Okastr8 Apps:");
        for (const app2 of result.apps) {
          console.log(`  • ${app2.name}${app2.description ? ` - ${app2.description}` : ""}`);
        }
      }
    } catch (error) {
      console.error(`Failed to list apps:`, error.message);
      process.exit(1);
    }
  });
  app.command("status").description("Show status of an application").argument("<name>", "Application name").action(async (name) => {
    try {
      const result = await getAppStatus(name);
      console.log(result.message);
    } catch (error) {
      console.error(`Failed to get status:`, error.message);
      process.exit(1);
    }
  });
  app.command("logs").description("Show logs for an application").argument("<name>", "Application name").option("-n, --lines <lines>", "Number of lines to show", "50").action(async (name, options) => {
    try {
      const result = await getAppLogs(name, parseInt(options.lines, 10));
      console.log(result.logs);
    } catch (error) {
      console.error(`Failed to get logs:`, error.message);
      process.exit(1);
    }
  });
  app.command("export-logs").description("Export logs to app directory").argument("<name>", "Application name").action(async (name) => {
    try {
      const result = await exportAppLogs(name);
      console.log(result.message);
    } catch (error) {
      console.error(`Failed to export logs:`, error.message);
      process.exit(1);
    }
  });
  app.command("start").description("Start an application").argument("<name>", "Application name").action(async (name) => {
    console.log(`Starting ${name}...`);
    const result = await startApp(name);
    console.log(result.message);
  });
  const env = app.command("env").description("Manage environment variables for an app");
  env.command("set").description("Set environment variables for an app").argument("<appName>", "Name of the app").argument("<key=value...>", "Environment variables in KEY=VALUE format").action(async (appName, keyValues) => {
    try {
      const { setEnvVar: setEnvVar2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      for (const pair of keyValues) {
        const [key, ...valueParts] = pair.split("=");
        if (!key || valueParts.length === 0) {
          console.error(`Invalid format: ${pair}. Expected KEY=VALUE`);
          process.exit(1);
        }
        const value = valueParts.join("=");
        await setEnvVar2(appName, key, value);
        console.log(`Set ${key}`);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });
  env.command("import").description("Import environment variables from a .env file").argument("<appName>", "Name of the app").option("-f, --file <path>", "Path to .env file", ".env").action(async (appName, options) => {
    try {
      const { importEnvFile: importEnvFile2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      await importEnvFile2(appName, options.file);
      console.log(`✅ Imported environment variables from ${options.file}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  env.command("list").description("List environment variable keys for an app").argument("<appName>", "Name of the app").action(async (appName) => {
    try {
      const { listEnvVars: listEnvVars2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      const keys = await listEnvVars2(appName);
      if (keys.length === 0) {
        console.log("No environment variables set");
      } else {
        console.log("Environment variables:");
        keys.forEach((key) => console.log(`  ${key}=••••••••`));
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  env.command("export").description("Export environment variables to a file").argument("<appName>", "Name of the app").option("-f, --file <path>", "Output file path", "exported.env").action(async (appName, options) => {
    try {
      const { exportEnvFile: exportEnvFile2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      await exportEnvFile2(appName, options.file);
      console.log(`✅ Exported environment variables to ${options.file}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  env.command("unset").description("Unset an environment variable").argument("<appName>", "Name of the app").argument("<key>", "Environment variable key to unset").action(async (appName, key) => {
    try {
      const { unsetEnvVar: unsetEnvVar2 } = await Promise.resolve().then(() => (init_env_manager(), exports_env_manager));
      await unsetEnvVar2(appName, key);
      console.log(`✅ Unset ${key}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  app.command("stop").description("Stop an application").argument("<name>", "Application name").action(async (name) => {
    console.log(`⏹️  Stopping ${name}...`);
    const result = await stopApp(name);
    console.log(result.message);
  });
  app.command("restart").description("Restart an application").argument("<name>", "Application name").action(async (name) => {
    console.log(`Restarting ${name}...`);
    const result = await restartApp(name);
    console.log(result.message);
  });
  app.command("webhook").description("Show or set auto-deploy webhook status for an app").argument("<name>", "Application name").argument("[state]", "State (enable/disable, on/off) - omit to show current status").action(async (name, state) => {
    try {
      if (!state) {
        const config = await getAppMetadata(name);
        const enabled = config?.webhookAutoDeploy ?? true;
        console.log(`Webhook auto-deploy for ${name}: ${enabled ? "ENABLED" : "DISABLED"}`);
      } else {
        const enabled = ["enable", "on", "true", "1"].includes(state.toLowerCase());
        console.log(`${enabled ? "Enabling" : "Disabling"} webhooks for ${name}...`);
        const result = await setAppWebhookAutoDeploy(name, enabled);
        console.log(result.message);
      }
    } catch (error) {
      console.error(`❌ Failed:`, error.message);
      process.exit(1);
    }
  });
}

// src/commands/deploy.ts
init_command();
init_config();
import { join as join19, dirname as dirname7 } from "path";
import { fileURLToPath as fileURLToPath6 } from "url";
import { readFile as readFile11, writeFile as writeFile10, mkdir as mkdir8 } from "fs/promises";
var __filename7 = fileURLToPath6(import.meta.url);
var __dirname7 = dirname7(__filename7);
var PROJECT_ROOT6 = join19(__dirname7, "..", "..");
var APPS_DIR8 = join19(OKASTR8_HOME, "apps");
var DEPLOYMENT_FILE = join19(OKASTR8_HOME, "deployment.json");
var SCRIPTS2 = {
  gitPull: join19(PROJECT_ROOT6, "scripts", "git", "pull.sh"),
  gitRollback: join19(PROJECT_ROOT6, "scripts", "git", "rollback.sh"),
  healthCheck: join19(PROJECT_ROOT6, "scripts", "deploy", "health-check.sh"),
  restart: join19(PROJECT_ROOT6, "scripts", "systemd", "restart.sh"),
  stop: join19(PROJECT_ROOT6, "scripts", "systemd", "stop.sh"),
  start: join19(PROJECT_ROOT6, "scripts", "systemd", "start.sh")
};
async function runHealthCheck(method, target, timeout = 30) {
  return await runCommand("bash", [
    SCRIPTS2.healthCheck,
    method,
    target,
    timeout.toString()
  ]);
}
async function deployApp(options) {
  const { appName, branch, skipHealthCheck } = options;
  console.log(`Starting deployment for ${appName}...`);
  try {
    const { getAppMetadata: getAppMetadata3, updateApp: updateApp2 } = await Promise.resolve().then(() => (init_app(), exports_app));
    if (branch) {
      try {
        const metadata = await getAppMetadata3(appName);
        if (metadata.gitBranch && metadata.gitBranch !== branch) {
          console.log(`
⚠️  WARNING: Branch change detected!`);
          console.log(`   Current branch: ${metadata.gitBranch}`);
          console.log(`   Requested branch: ${branch}`);
          console.log(`   Webhooks will only trigger for the new branch.
`);
          const readline = await import("readline");
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          const answer = await new Promise((resolve) => {
            rl.question("Continue with branch change? (y/N): ", resolve);
          });
          rl.close();
          if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
            console.log("Deployment cancelled.");
            return { success: false, message: "Deployment cancelled by user" };
          }
          console.log(`Proceeding with deployment to ${branch}...`);
        }
      } catch {}
    }
    console.log(`
Using immutable deployment strategy (V2)...`);
    const result = await updateApp2(appName);
    const { sendDeploymentAlertEmail: sendDeploymentAlertEmail2 } = await Promise.resolve().then(() => (init_email(), exports_email));
    if (result.success) {
      console.log(`
✅ ${result.message}`);
      const releaseId = result.data?.releaseId || "unknown";
      await sendDeploymentAlertEmail2(appName, "success", `Deployment to ${branch || "default branch"} successful.
Release ID: ${releaseId}`);
      try {
        const { genCaddyFile: genCaddyFile2 } = await Promise.resolve().then(() => (init_genCaddyFile(), exports_genCaddyFile));
        await genCaddyFile2();
      } catch (err) {
        console.error(`⚠️ Failed to update Caddy routing: ${err.message}`);
      }
    } else {
      console.error(`
❌ ${result.message}`);
      await sendDeploymentAlertEmail2(appName, "failed", result.message);
    }
    return result;
  } catch (error) {
    console.error(`❌ Deployment failed: ${error.message}`);
    try {
      const { sendDeploymentAlertEmail: sendDeploymentAlertEmail2 } = await Promise.resolve().then(() => (init_email(), exports_email));
      await sendDeploymentAlertEmail2(appName, "failed", error.message);
    } catch {}
    return { success: false, message: error.message };
  }
}
async function rollbackApp(appName, commitHash) {
  const appDir = join19(APPS_DIR8, appName);
  const repoDir = join19(appDir, "repo");
  console.log(`⏪ Rolling back ${appName}...`);
  try {
    if (!commitHash) {
      const content = await readFile11(DEPLOYMENT_FILE, "utf-8");
      const record = JSON.parse(content);
      const entry = record.deployments.find((d) => d.serviceName === appName);
      if (!entry || !entry.lastSuccessfulDeploy) {
        throw new Error(`No previous successful deployment found for ${appName}`);
      }
      commitHash = entry.lastSuccessfulDeploy.gitHash;
    }
    console.log(`  → Checking out ${commitHash}...`);
    const checkoutResult = await runCommand("git", ["-C", repoDir, "checkout", commitHash]);
    if (checkoutResult.exitCode !== 0) {
      throw new Error(`Git checkout failed: ${checkoutResult.stderr}`);
    }
    console.log(`  → Restarting service...`);
    const restartResult = await runCommand("sudo", [SCRIPTS2.restart, appName]);
    if (restartResult.exitCode !== 0) {
      throw new Error(`Service restart failed: ${restartResult.stderr}`);
    }
    console.log(`✅ Rolled back ${appName} to ${commitHash}`);
    return { success: true, message: `Rolled back to ${commitHash}` };
  } catch (error) {
    console.error(`❌ Rollback failed: ${error.message}`);
    return { success: false, message: error.message };
  }
}
async function getDeploymentHistory(appName) {
  try {
    const content = await readFile11(DEPLOYMENT_FILE, "utf-8");
    const record = JSON.parse(content);
    const entry = record.deployments.find((d) => d.serviceName === appName);
    return { success: true, history: entry?.deploys || [] };
  } catch {
    return { success: true, history: [] };
  }
}
function addDeployCommands(program2) {
  const deploy = program2.command("deploy").description("Deployment management commands");
  deploy.command("trigger").description("Trigger a deployment for an app").argument("<app>", "Application name").option("-b, --branch <branch>", "Git branch to deploy").option("--build <steps>", "Build steps (comma-separated)").option("--health-method <method>", "Health check method (http, process, port, command)").option("--health-target <target>", "Health check target").option("--health-timeout <seconds>", "Health check timeout", "30").option("--skip-health", "Skip health check").action(async (app, options) => {
    const buildSteps = options.build ? options.build.split(",").map((s) => s.trim()) : [];
    const healthCheck = options.healthMethod && options.healthTarget ? {
      method: options.healthMethod,
      target: options.healthTarget,
      timeout: parseInt(options.healthTimeout, 10)
    } : undefined;
    const result = await deployApp({
      appName: app,
      branch: options.branch,
      buildSteps,
      healthCheck,
      skipHealthCheck: options.skipHealth
    });
    if (!result.success) {
      process.exit(1);
    }
  });
  deploy.command("rollback").description("Rollback an app to a previous version").argument("<app>", "Application name").option("-c, --commit <hash>", "Specific commit hash to rollback to").action(async (app, options) => {
    const result = await rollbackApp(app, options.commit);
    if (!result.success) {
      process.exit(1);
    }
  });
  deploy.command("history").description("Show deployment history for an app").argument("<app>", "Application name").action(async (app) => {
    const result = await getDeploymentHistory(app);
    if (result.history.length === 0) {
      console.log(`No deployment history for ${app}`);
    } else {
      console.log(`Deployment history for ${app}:`);
      for (const d of result.history.slice(-10).reverse()) {
        const date = new Date(d.timeStamp).toLocaleString();
        console.log(`  • ${d.gitHash.substring(0, 7)} - ${date}`);
      }
    }
  });
  deploy.command("health").description("Run a health check").argument("<method>", "Check method: http, process, port, command").argument("<target>", "Check target").option("-t, --timeout <seconds>", "Timeout in seconds", "30").action(async (method, target, options) => {
    const result = await runHealthCheck(method, target, parseInt(options.timeout, 10));
    console.log(result.stdout || result.stderr);
    if (result.exitCode !== 0) {
      process.exit(1);
    }
  });
}

// src/commands/github-cli.ts
init_command();
init_github();
import { join as join20 } from "path";
import { homedir as homedir5 } from "os";
import { existsSync as existsSync13 } from "fs";
import { readFile as readFile12 } from "fs/promises";
var SSH_KEY_PATH = join20(homedir5(), ".ssh", "okastr8_deploy_key");
function addGitHubCommands(program2) {
  const github = program2.command("github").description("GitHub integration commands");
  github.command("status").description("Check GitHub connection status").action(async () => {
    try {
      const status = await getConnectionStatus();
      if (status.connected) {
        console.log(`✅ Connected to GitHub as: ${status.username}`);
        console.log(`   Connected at: ${status.connectedAt}`);
        const config = await getGitHubConfig();
        if (config.accessToken) {
          const hasKey = await hasOkastr8DeployKey(config.accessToken);
          console.log(`   Deploy key: ${hasKey ? "✅ Configured" : "❌ Not configured"}`);
        }
      } else {
        console.log("❌ Not connected to GitHub");
        console.log("   Use the web UI to connect via OAuth, or configure manually.");
      }
    } catch (error) {
      console.error("Error checking status:", error.message);
      process.exit(1);
    }
  });
  github.command("connect").description("Connect to GitHub via OAuth (opens browser)").action(async () => {
    try {
      const config = await getGitHubConfig();
      if (!config.clientId || !config.clientSecret) {
        console.error("❌ GitHub OAuth not configured.");
        console.error("   Add to system.yaml:");
        console.error("     manager:");
        console.error("       github:");
        console.error("         client_id: YOUR_CLIENT_ID");
        console.error("         client_secret: YOUR_CLIENT_SECRET");
        process.exit(1);
      }
      const status = await getConnectionStatus();
      if (status.connected) {
        console.log(`Already connected as ${status.username}.`);
        console.log("Run 'okastr8 github disconnect' first to reconnect.");
        return;
      }
      const callbackUrl = `http://localhost:41788/api/github/callback`;
      const { getAuthUrl: getAuthUrl2 } = await Promise.resolve().then(() => (init_github(), exports_github));
      const authUrl = getAuthUrl2(config.clientId, callbackUrl);
      console.log(`
Open this URL in your browser:
`);
      console.log(`   ${authUrl}
`);
      try {
        const { exec } = await import("child_process");
        const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        exec(`${openCmd} "${authUrl}"`);
        console.log(`   (Attempting to open browser automatically...)
`);
      } catch {}
      console.log("⏳ Waiting for authorization...");
      console.log(`   (Make sure okastr8-manager is running)
`);
      const maxAttempts = 150;
      for (let i2 = 0;i2 < maxAttempts; i2++) {
        const newStatus = await getConnectionStatus();
        if (newStatus.connected) {
          console.log(`
✅ Connected to GitHub as: ${newStatus.username}`);
          return;
        }
        process.stdout.write(".");
        await new Promise((r) => setTimeout(r, 2000));
      }
      console.log(`
❌ Timed out waiting for authorization.`);
      process.exit(1);
    } catch (error) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  });
  github.command("repos").description("Browse and import GitHub repositories").option("--plain", "Plain list output (no interactive mode)").action(async (options) => {
    try {
      const config = await getGitHubConfig();
      if (!config.accessToken) {
        console.error("❌ Not connected to GitHub. Run 'okastr8 github connect' first.");
        process.exit(1);
      }
      console.log(`Fetching repositories...
`);
      const repos = await listRepos(config.accessToken);
      if (repos.length === 0) {
        console.log("No repositories found.");
        return;
      }
      const { listApps: listApps3 } = await Promise.resolve().then(() => (init_app(), exports_app));
      const { apps: deployedApps } = await listApps3();
      const deployedRepos = new Map;
      for (const app of deployedApps) {
        if (app.gitRepo) {
          const match = app.gitRepo.match(/github\.com[/:]([^/]+\/[^/.]+)/);
          if (match) {
            deployedRepos.set(match[1].toLowerCase(), {
              appName: app.name,
              branch: app.gitBranch || "main"
            });
          }
        }
      }
      if (options.plain) {
        for (const repo2 of repos) {
          const privacyIcon = repo2.private ? "[PRIVATE]" : "[PUBLIC]";
          const deployed2 = deployedRepos.get(repo2.full_name.toLowerCase());
          const status = deployed2 ? ` [✅ deployed: ${deployed2.appName}@${deployed2.branch}]` : "";
          console.log(`${privacyIcon} ${repo2.full_name}${status}`);
        }
        return;
      }
      const Enquirer2 = (await Promise.resolve().then(() => __toESM(require_enquirer(), 1))).default;
      const choices = repos.map((repo2) => {
        const deployed2 = deployedRepos.get(repo2.full_name.toLowerCase());
        if (deployed2) {
          return `✅ ${repo2.full_name} [${deployed2.appName}@${deployed2.branch}]`;
        }
        return `   ${repo2.full_name}`;
      });
      const response = await Enquirer2.prompt({
        type: "autocomplete",
        name: "repo",
        message: `Select a repository (${repos.length} total, ✅ = deployed):`,
        limit: 10,
        choices
      });
      const selectedRaw = response.repo;
      const repoName = selectedRaw.replace(/^[✅\s]+/, "").split(" [")[0];
      const repo = repos.find((r) => r.full_name === repoName);
      if (!repo)
        return;
      const deployed = deployedRepos.get(repo.full_name.toLowerCase());
      console.log(`
${repo.full_name}`);
      console.log(`   ${repo.private ? "Private" : "Public"}`);
      if (repo.description)
        console.log(`   ${repo.description}`);
      console.log(`   Default Branch: ${repo.default_branch}`);
      if (deployed) {
        console.log(`   Deployed as: ${deployed.appName} (branch: ${deployed.branch})`);
      }
      const actionChoices = deployed ? ["Redeploy", "View Details", "Open on GitHub", "Cancel"] : ["Import and Deploy", "View Details", "Open on GitHub", "Cancel"];
      const actionResponse = await Enquirer2.prompt({
        type: "select",
        name: "action",
        message: "What would you like to do?",
        choices: actionChoices
      });
      const action = actionResponse.action;
      if (action.includes("Cancel")) {
        console.log("Cancelled.");
        return;
      }
      if (action.includes("Open on GitHub")) {
        const { exec } = await import("child_process");
        const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        exec(`${openCmd} "${repo.html_url}"`);
        console.log(`Opening ${repo.html_url}`);
        return;
      }
      if (action.includes("View Details")) {
        console.log(`
Full Details for ${repo.full_name}`);
        console.log(`   URL: ${repo.html_url}`);
        console.log(`   Clone: ${repo.clone_url}`);
        console.log(`   Language: ${repo.language || "Unknown"}`);
        console.log(`   Updated: ${new Date(repo.updated_at).toLocaleDateString()}`);
        console.log(`   Pushed: ${new Date(repo.pushed_at).toLocaleDateString()}`);
        return;
      }
      if (action.includes("Import") || action.includes("Redeploy")) {
        const branchResponse = await Enquirer2.prompt({
          type: "input",
          name: "branch",
          message: "Branch to deploy:",
          initial: deployed?.branch || repo.default_branch
        });
        const branch = branchResponse.branch;
        if (deployed && branch !== deployed.branch) {
          console.log(`
⚠️  WARNING: Changing branch from '${deployed.branch}' to '${branch}'`);
          const confirmResponse = await Enquirer2.prompt({
            type: "confirm",
            name: "confirm",
            message: "Are you sure you want to change the deployment branch?",
            initial: false
          });
          if (!confirmResponse.confirm) {
            console.log("Cancelled.");
            return;
          }
        }
        let appName = deployed?.appName;
        if (!deployed) {
          const nameResponse = await Enquirer2.prompt({
            type: "input",
            name: "appName",
            message: "App name:",
            initial: repo.name
          });
          appName = nameResponse.appName;
        }
        console.log(`
${deployed ? "Redeploying" : "Importing"} ${repo.full_name}...`);
        console.log(`   App: ${appName}`);
        console.log(`   Branch: ${branch}
`);
        const result = await importRepo({
          repoFullName: repo.full_name,
          appName,
          branch,
          setupWebhook: true
        });
        if (result.success) {
          console.log(`
✅ ${result.message}`);
        } else {
          console.error(`
❌ ${result.message}`);
        }
      }
    } catch (error) {
      if (error.message === "" || error.name === "ExitPromptError") {
        console.log(`
Cancelled.`);
        return;
      }
      console.error("Error:", error.message);
      process.exit(1);
    }
  });
  github.command("import").description("Import and deploy a GitHub repository").argument("<repo>", "Repository full name (e.g., owner/repo)").option("-b, --branch <branch>", "Branch to deploy").option("--no-webhook", "Don't setup webhook for auto-deploys").action(async (repo, options) => {
    try {
      const config = await getGitHubConfig();
      if (!config.accessToken) {
        console.error("❌ Not connected to GitHub. Use web UI to connect first.");
        process.exit(1);
      }
      console.log(`
Importing ${repo}...
`);
      const result = await importRepo({
        repoFullName: repo,
        branch: options.branch,
        setupWebhook: options.webhook !== false
      });
      if (result.success) {
        console.log(`
✅ ${result.message}`);
        if (result.appName) {
          console.log(`   App name: ${result.appName}`);
        }
      } else {
        console.error(`
❌ ${result.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.error("Error importing repo:", error.message);
      process.exit(1);
    }
  });
  github.command("disconnect").description("Disconnect from GitHub").action(async () => {
    try {
      const readline = await import("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      const answer = await new Promise((resolve) => {
        rl.question("Are you sure you want to disconnect from GitHub? (y/N): ", resolve);
      });
      rl.close();
      if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
        console.log("Cancelled.");
        return;
      }
      await disconnectGitHub();
      console.log("✅ Disconnected from GitHub");
    } catch (error) {
      console.error("Error disconnecting:", error.message);
      process.exit(1);
    }
  });
  github.command("setup-key").description("Setup SSH deploy key for passwordless cloning").action(async () => {
    try {
      const config = await getGitHubConfig();
      if (!config.accessToken) {
        console.error("❌ Not connected to GitHub. Use web UI to connect first.");
        process.exit(1);
      }
      console.log("Checking existing keys...");
      const keyExists = await hasOkastr8DeployKey(config.accessToken);
      if (keyExists) {
        console.log("Deploy key already configured in GitHub!");
        return;
      }
      const pubKeyPath = `${SSH_KEY_PATH}.pub`;
      if (!existsSync13(pubKeyPath)) {
        console.log("Generating new SSH deploy key...");
        const sshDir = join20(homedir5(), ".ssh");
        await runCommand("mkdir", ["-p", sshDir]);
        await runCommand("chmod", ["700", sshDir]);
        const genResult = await runCommand("ssh-keygen", [
          "-t",
          "ed25519",
          "-f",
          SSH_KEY_PATH,
          "-N",
          "",
          "-C",
          "okastr8-deploy-key"
        ]);
        if (genResult.exitCode !== 0) {
          console.error(`Failed to generate key: ${genResult.stderr}`);
          process.exit(1);
        }
        console.log("✅ SSH key generated");
      }
      const publicKey = (await readFile12(pubKeyPath, "utf-8")).trim();
      console.log("☁️ Adding key to GitHub...");
      const hostname = (await runCommand("hostname", [])).stdout.trim();
      const keyTitle = `Okastr8 Deploy Key (${hostname})`;
      const result = await createSSHKey(config.accessToken, keyTitle, publicKey);
      if (!result.success) {
        console.error(`Failed to add key to GitHub: ${result.message}`);
        process.exit(1);
      }
      console.log("Configuring Git to use SSH...");
      await runCommand("git", ["config", "--global", "url.git@github.com:.insteadOf", "https://github.com/"]);
      console.log(`
✅ Deploy key configured successfully!`);
      console.log("   All GitHub clones will now use SSH automatically.");
    } catch (error) {
      console.error("Error setting up key:", error.message);
      process.exit(1);
    }
  });
}

// src/commands/metrics.ts
init_command();
import { cpus, freemem, totalmem, uptime as osUptime, loadavg } from "os";
import { existsSync as existsSync14 } from "fs";
import { readFile as readFile13 } from "fs/promises";
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
async function getSystemMetrics() {
  const totalMem = totalmem();
  const freeMem = freemem();
  const usedMem = totalMem - freeMem;
  const uptimeSec = osUptime();
  const load2 = loadavg();
  const cores = cpus().length;
  const cpuUsage = Math.min(100, load2[0] / cores * 100);
  return {
    cpu: {
      usage: Math.round(cpuUsage * 10) / 10,
      cores
    },
    memory: {
      used: Math.round(usedMem / 1024 / 1024),
      total: Math.round(totalMem / 1024 / 1024),
      percent: Math.round(usedMem / totalMem * 100),
      free: Math.round(freeMem / 1024 / 1024)
    },
    uptime: formatUptime(uptimeSec),
    uptimeSeconds: Math.floor(uptimeSec),
    load: [
      Math.round(load2[0] * 100) / 100,
      Math.round(load2[1] * 100) / 100,
      Math.round(load2[2] * 100) / 100
    ]
  };
}
async function getServiceMetrics(serviceName) {
  try {
    const statusResult = await runCommand("systemctl", ["is-active", serviceName]);
    const statusOutput = statusResult.stdout.trim();
    let status = "unknown";
    if (statusOutput === "active")
      status = "running";
    else if (statusOutput === "inactive")
      status = "stopped";
    else if (statusOutput === "failed")
      status = "failed";
    else
      status = "stopped";
    let cpu = 0;
    let memory = 0;
    let uptimeSeconds = 0;
    let pid;
    if (status === "running") {
      const showResult = await runCommand("systemctl", [
        "show",
        serviceName,
        "--property=MainPID,CPUUsageNSec,MemoryCurrent,ActiveEnterTimestampMonotonic"
      ]);
      const props = {};
      for (const line of showResult.stdout.split(`
`)) {
        const [key, ...valueParts] = line.split("=");
        if (key && valueParts.length) {
          props[key.trim()] = valueParts.join("=").trim();
        }
      }
      if (props.MainPID && props.MainPID !== "0") {
        pid = parseInt(props.MainPID, 10);
      }
      if (props.MemoryCurrent && !props.MemoryCurrent.includes("not set")) {
        const memBytes = parseInt(props.MemoryCurrent, 10);
        if (!isNaN(memBytes)) {
          memory = Math.round(memBytes / 1024 / 1024);
        }
      }
      if (memory === 0) {
        const cgroupPath = `/sys/fs/cgroup/system.slice/${serviceName}.service/memory.current`;
        if (existsSync14(cgroupPath)) {
          try {
            const memContent = await readFile13(cgroupPath, "utf-8");
            const memBytes = parseInt(memContent.trim(), 10);
            if (!isNaN(memBytes)) {
              memory = Math.round(memBytes / 1024 / 1024);
            }
          } catch {}
        }
      }
      if (pid) {
        const psResult = await runCommand("ps", ["-p", pid.toString(), "-o", "%cpu", "--no-headers"]);
        const cpuStr = psResult.stdout.trim();
        if (cpuStr) {
          cpu = parseFloat(cpuStr) || 0;
        }
      }
      if (props.ActiveEnterTimestampMonotonic && props.ActiveEnterTimestampMonotonic !== "0") {
        try {
          const startMonotonicUSec = parseInt(props.ActiveEnterTimestampMonotonic, 10);
          const systemUptimeSec = osUptime();
          if (!isNaN(startMonotonicUSec)) {
            uptimeSeconds = Math.max(0, Math.floor(systemUptimeSec - startMonotonicUSec / 1e6));
          }
        } catch {}
      }
    }
    const totalMem = totalmem() / 1024 / 1024;
    return {
      name: serviceName,
      cpu: Math.round(cpu * 10) / 10,
      memory,
      memoryPercent: Math.round(memory / totalMem * 100 * 10) / 10,
      uptime: formatUptime(uptimeSeconds),
      uptimeSeconds,
      status,
      pid
    };
  } catch (error) {
    console.error(`Error getting metrics for ${serviceName}:`, error);
    return null;
  }
}
async function getOkastr8Services() {
  const services = ["okastr8-manager"];
  try {
    const { listApps: listApps3 } = await Promise.resolve().then(() => (init_app(), exports_app));
    const result = await listApps3();
    if (result.success && Array.isArray(result.apps)) {
      for (const app of result.apps) {
        if (app?.name) {
          services.push(app.name);
        }
      }
    }
  } catch {}
  return services;
}
var previousRequestCounts = {};
async function getCaddyMetrics() {
  const result = {
    totalRequests: 0,
    byDomain: {}
  };
  try {
    const response = await fetch("http://localhost:2019/metrics");
    if (!response.ok) {
      return result;
    }
    const text = await response.text();
    const lines = text.split(`
`);
    for (const line of lines) {
      if (line.startsWith("#") || !line.trim())
        continue;
      if (line.startsWith("caddy_http_requests_total")) {
        const hostMatch = line.match(/host="([^"]+)"/);
        const valueMatch = line.match(/\}\s+(\d+(?:\.\d+)?)/);
        if (hostMatch && hostMatch[1] && valueMatch && valueMatch[1]) {
          const host = hostMatch[1];
          const count = parseInt(valueMatch[1], 10);
          if (!isNaN(count)) {
            result.byDomain[host] = (result.byDomain[host] || 0) + count;
            result.totalRequests += count;
          }
        }
      }
    }
  } catch (error) {}
  return result;
}
async function getAppDomains() {
  const domainToApp = {};
  try {
    const { listApps: listApps3 } = await Promise.resolve().then(() => (init_app(), exports_app));
    const result = await listApps3();
    if (result.success && Array.isArray(result.apps)) {
      for (const app of result.apps) {
        if (app?.name && app?.domain) {
          domainToApp[app.domain] = app.name;
        }
      }
    }
  } catch {}
  return domainToApp;
}
async function collectMetrics() {
  const [system, serviceNames, traffic, domainToApp] = await Promise.all([
    getSystemMetrics(),
    getOkastr8Services(),
    getCaddyMetrics(),
    getAppDomains()
  ]);
  const appToDomain = {};
  for (const [domain, appName] of Object.entries(domainToApp)) {
    appToDomain[appName] = domain;
  }
  const now = Date.now();
  const serviceMetrics = [];
  for (const name of serviceNames) {
    const metrics = await getServiceMetrics(name);
    if (metrics) {
      const domain = appToDomain[name];
      if (domain) {
        metrics.domain = domain;
        metrics.requestsTotal = traffic.byDomain[domain] || 0;
        const prev = previousRequestCounts[domain];
        if (prev && now > prev.timestamp) {
          const timeDelta = (now - prev.timestamp) / 1000;
          const countDelta = metrics.requestsTotal - prev.count;
          metrics.requestsPerSec = Math.max(0, Math.round(countDelta / timeDelta * 10) / 10);
        } else {
          metrics.requestsPerSec = 0;
        }
        previousRequestCounts[domain] = {
          count: metrics.requestsTotal,
          timestamp: now
        };
      }
      serviceMetrics.push(metrics);
    }
  }
  return {
    system,
    services: serviceMetrics,
    traffic,
    timestamp: new Date().toISOString()
  };
}

// src/commands/metrics-cli.ts
var ESC = "\x1B";
var CLEAR = `${ESC}[2J${ESC}[H`;
var BOLD = `${ESC}[1m`;
var RESET = `${ESC}[0m`;
var DIM = `${ESC}[2m`;
var GREEN = `${ESC}[32m`;
var RED = `${ESC}[31m`;
var YELLOW = `${ESC}[33m`;
var BLUE = `${ESC}[34m`;
var CYAN = `${ESC}[36m`;
var MAGENTA = `${ESC}[35m`;
function progressBar(percent, width = 20, filled = "█", empty = "░") {
  const filledCount = Math.round(percent / 100 * width);
  const emptyCount = width - filledCount;
  return filled.repeat(Math.max(0, filledCount)) + empty.repeat(Math.max(0, emptyCount));
}
function getStatusColor(status) {
  switch (status) {
    case "running":
      return GREEN;
    case "stopped":
      return DIM;
    case "failed":
      return RED;
    default:
      return RESET;
  }
}
function padRight(str2, len) {
  return str2.length >= len ? str2.slice(0, len) : str2 + " ".repeat(len - str2.length);
}
function padLeft(str2, len) {
  return str2.length >= len ? str2.slice(0, len) : " ".repeat(len - str2.length) + str2;
}
function renderSystemOverview(system) {
  const lines = [];
  lines.push(`${BOLD}${CYAN}╭──────────────────────────────────────────────────────────────────╮${RESET}`);
  lines.push(`${BOLD}${CYAN}│${RESET}  ${BOLD}SYSTEM OVERVIEW${RESET}                                               ${CYAN}│${RESET}`);
  lines.push(`${CYAN}├──────────────────────────────────────────────────────────────────┤${RESET}`);
  const cpuBar = progressBar(system.cpu.usage);
  const cpuColor = system.cpu.usage > 80 ? RED : system.cpu.usage > 50 ? YELLOW : GREEN;
  lines.push(`${CYAN}│${RESET}  CPU   ${cpuColor}${cpuBar}${RESET} ${padLeft(system.cpu.usage.toFixed(1), 5)}%  [${system.cpu.cores} cores]                   ${CYAN}│${RESET}`);
  const memBar = progressBar(system.memory.percent);
  const memColor = system.memory.percent > 80 ? RED : system.memory.percent > 50 ? YELLOW : GREEN;
  const memUsed = (system.memory.used / 1024).toFixed(1);
  const memTotal = (system.memory.total / 1024).toFixed(1);
  lines.push(`${CYAN}│${RESET}  MEM   ${memColor}${memBar}${RESET} ${padLeft(system.memory.percent.toString(), 5)}%  [${memUsed}/${memTotal} GB]          ${CYAN}│${RESET}`);
  lines.push(`${CYAN}│${RESET}  Load: ${system.load.join(" ")}    Uptime: ${system.uptime}                          ${CYAN}│${RESET}`);
  lines.push(`${CYAN}╰──────────────────────────────────────────────────────────────────╯${RESET}`);
  return lines.join(`
`);
}
function renderServicesTable(services) {
  const lines = [];
  lines.push("");
  lines.push(`${BOLD}${MAGENTA}╭──────────────────────────────────────────────────────────────────────────────╮${RESET}`);
  lines.push(`${BOLD}${MAGENTA}│${RESET}  ${BOLD}SERVICE METRICS${RESET}                                                            ${MAGENTA}│${RESET}`);
  lines.push(`${MAGENTA}├──────────────────────────────────────────────────────────────────────────────┤${RESET}`);
  lines.push(`${MAGENTA}│${RESET}  ${DIM}${padRight("NAME", 22)} ${padLeft("STATUS", 8)} ${padLeft("CPU%", 6)} ${padLeft("MEM", 8)} ${padRight("UPTIME", 12)} ${padLeft("REQ/S", 8)}${RESET}${MAGENTA}│${RESET}`);
  lines.push(`${MAGENTA}├──────────────────────────────────────────────────────────────────────────────┤${RESET}`);
  for (const svc of services) {
    const statusColor = getStatusColor(svc.status);
    const name = padRight(svc.name, 22);
    const status = padLeft(svc.status, 8);
    const cpu = svc.status === "running" ? padLeft(svc.cpu.toFixed(1), 6) : padLeft("-", 6);
    const mem = svc.status === "running" ? padLeft(svc.memory + " MB", 8) : padLeft("-", 8);
    const uptime = svc.status === "running" ? padRight(svc.uptime, 12) : padRight("-", 12);
    const reqs = svc.status === "running" && svc.requestsPerSec !== undefined ? padLeft(svc.requestsPerSec.toFixed(1), 8) : padLeft("-", 8);
    lines.push(`${MAGENTA}│${RESET}  ${name} ${statusColor}${status}${RESET} ${cpu} ${mem} ${uptime} ${reqs}${MAGENTA}│${RESET}`);
  }
  lines.push(`${MAGENTA}╰──────────────────────────────────────────────────────────────────────────────╯${RESET}`);
  return lines.join(`
`);
}
function renderFooter() {
  return `
${DIM}Press Ctrl+C to exit • Refreshing every 1s${RESET}
`;
}
var CURSOR_HIDE = `${ESC}[?25l`;
var CURSOR_SHOW = `${ESC}[?25h`;
var CLEAR_SCREEN = `${ESC}[2J`;
var CURSOR_HOME = `${ESC}[H`;
async function runMetricsLoop() {
  let running = true;
  process.stdout.write(CURSOR_HIDE);
  const cleanup = () => {
    running = false;
    process.stdout.write(CURSOR_SHOW);
    console.log(`
${GREEN}Exiting metrics view...${RESET}`);
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  while (running) {
    try {
      const metrics = await collectMetrics();
      let output = "";
      output += `${ESC}[2J${ESC}[3J${ESC}[H`;
      output += `${BOLD}${BLUE}okastr8 metrics${RESET} ${DIM}${new Date().toLocaleTimeString()}${RESET}

`;
      output += renderSystemOverview(metrics.system) + `
`;
      output += renderServicesTable(metrics.services) + `
`;
      output += renderFooter();
      process.stdout.write(output);
    } catch (error) {
      console.error(`${RED}Error collecting metrics: ${error.message}${RESET}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
async function runMetricsOnce() {
  try {
    const metrics = await collectMetrics();
    console.log(`${BOLD}${BLUE}okastr8 metrics${RESET} ${DIM}${new Date().toLocaleTimeString()}${RESET}
`);
    console.log(renderSystemOverview(metrics.system));
    console.log(renderServicesTable(metrics.services));
  } catch (error) {
    console.error(`${RED}Error collecting metrics: ${error.message}${RESET}`);
    process.exit(1);
  }
}
function addMetricsCommands(program2) {
  program2.command("metrics").description("Show live system and service metrics (htop-style)").option("-1, --once", "Show metrics once and exit (no live updates)").action(async (options) => {
    if (options.once) {
      await runMetricsOnce();
    } else {
      await runMetricsLoop();
    }
  });
}

// src/commands/auth-cli.ts
init_auth();
function addAuthCommands(program2) {
  const auth = program2.command("auth").description("Authentication and token management (admin only)");
  auth.command("token").description("Generate an access token for UI login").option("-e, --expiry <duration>", "Token expiry (30m, 1h, 1d, 1w, 30d)", "1d").action(async (options) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        const adminUser = await getAdminUser();
        console.error(`❌ Only the admin user (${adminUser}) can generate tokens.`);
        console.error(`   Current user: ${process.env.SUDO_USER || process.env.USER}`);
        process.exit(1);
      }
      const { token, expiresAt } = await generateAdminToken(options.expiry);
      console.log(`
Admin Access Token Generated
`);
      console.log("━".repeat(50));
      console.log(`Token: ${token}`);
      console.log("━".repeat(50));
      console.log(`
Expires: ${new Date(expiresAt).toLocaleString()}`);
      console.log(`
Use this token to log in to the okastr8 UI`);
      console.log(`   Paste it in the login page to get access.
`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  auth.command("list").description("List all active tokens").action(async () => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can list tokens");
        process.exit(1);
      }
      const tokens = await listTokens();
      if (tokens.length === 0) {
        console.log("No active tokens.");
        return;
      }
      console.log(`
Active Tokens
`);
      console.log("ID".padEnd(16) + "User".padEnd(25) + "Expires".padEnd(25) + "Permissions");
      console.log("─".repeat(80));
      for (const t of tokens) {
        const id = t.id.slice(0, 12) + "...";
        const user = t.userId.slice(0, 22);
        const expires = new Date(t.expiresAt).toLocaleString();
        const perms = t.permissions.slice(0, 3).join(", ") + (t.permissions.length > 3 ? "..." : "");
        console.log(`${id.padEnd(16)}${user.padEnd(25)}${expires.padEnd(25)}${perms}`);
      }
      console.log("");
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  auth.command("revoke <tokenId>").description("Revoke a token by ID").action(async (tokenId) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can revoke tokens");
        process.exit(1);
      }
      const tokens = await listTokens();
      const match = tokens.find((t) => t.id.startsWith(tokenId));
      if (!match) {
        console.error(`❌ Token not found: ${tokenId}`);
        process.exit(1);
      }
      const success = await revokeToken(match.id);
      if (success) {
        console.log(`✅ Token revoked: ${match.id.slice(0, 12)}...`);
      } else {
        console.error("❌ Failed to revoke token");
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  auth.command("test-email").description("Send a test email to verify Brevo configuration").action(async () => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can test email");
        process.exit(1);
      }
      console.log("Sending test email...");
      const { testEmailConfig: testEmailConfig2 } = await Promise.resolve().then(() => (init_email(), exports_email));
      const result = await testEmailConfig2();
      if (result.success) {
        console.log("✅ Test email sent successfully!");
        console.log("   Check your inbox for the confirmation.");
      } else {
        console.error(`❌ Failed to send: ${result.error}`);
        console.error("   Make sure your system.yaml has the notifications.brevo section configured.");
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  auth.command("pending").description("List pending login approval requests").action(async () => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can view pending approvals");
        process.exit(1);
      }
      const { listPendingApprovals: listPendingApprovals2 } = await Promise.resolve().then(() => (init_auth(), exports_auth));
      const pending = await listPendingApprovals2();
      if (pending.length === 0) {
        console.log("No pending login requests.");
        return;
      }
      console.log(`
⏳ Pending Login Requests
`);
      console.log("ID".padEnd(12) + "User".padEnd(30) + "Requested".padEnd(25) + "Expires In");
      console.log("─".repeat(80));
      for (const p of pending) {
        const id = p.id.slice(0, 8);
        const user = p.userId.slice(0, 27);
        const requested = new Date(p.requestedAt).toLocaleString();
        const expiresIn = Math.round((new Date(p.expiresAt).getTime() - Date.now()) / 1000);
        const expiresStr = expiresIn > 0 ? `${expiresIn}s` : "expired";
        console.log(`${id.padEnd(12)}${user.padEnd(30)}${requested.padEnd(25)}${expiresStr}`);
      }
      console.log(`
To approve: okastr8 auth approve <id>`);
      console.log(`To reject:  okastr8 auth reject <id>
`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  auth.command("approve <requestId>").description("Approve a pending login request").action(async (requestId) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can approve requests");
        process.exit(1);
      }
      const { approveRequest: approveRequest2 } = await Promise.resolve().then(() => (init_auth(), exports_auth));
      const result = await approveRequest2(requestId);
      if (result.success) {
        console.log(`✅ Approved login for: ${result.userId}`);
        console.log("   They should now have access to the dashboard.");
      } else {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  auth.command("reject <requestId>").description("Reject a pending login request").action(async (requestId) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can reject requests");
        process.exit(1);
      }
      const { rejectRequest: rejectRequest2 } = await Promise.resolve().then(() => (init_auth(), exports_auth));
      const result = await rejectRequest2(requestId);
      if (result.success) {
        console.log(`❌ Rejected login for: ${result.userId}`);
      } else {
        console.error(`❌ ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
}

// src/commands/user-cli.ts
init_auth();

// src/permissions.ts
var PERMISSIONS = {
  "*": "Full admin access - all permissions",
  "view:*": "All view permissions",
  "view:dashboard": "View main dashboard",
  "view:metrics": "View system metrics",
  "view:logs": "View application logs",
  "view:deployments": "View deployment history",
  "view:apps": "View application list and details",
  "view:github": "View GitHub configuration",
  "view:users": "View Linux users",
  "view:services": "View systemd services",
  "deploy:*": "Deploy all applications",
  "app:*": "All app management permissions",
  "app:restart": "Restart applications",
  "app:stop": "Stop applications",
  "app:start": "Start applications",
  "app:rollback": "Rollback to previous version",
  "app:create": "Create new applications",
  "app:delete": "Delete applications",
  "app:update": "Update/deploy applications",
  "github:*": "All GitHub permissions",
  "github:manage": "Manage GitHub settings and tokens",
  "github:import": "Import repositories",
  "github:webhook": "Configure webhooks",
  "system:*": "All system permissions",
  "system:services": "Manage systemd services",
  "system:control": "Global system controls (Stop All, etc.)",
  "system:setup": "Run setup commands",
  "system:orchestrate": "Run orchestration",
  "users:*": "All user permissions",
  "users:manage": "Manage Linux users",
  "users:access": "Manage access users (okastr8)",
  "settings:*": "All settings",
  "settings:view": "View system settings",
  "settings:edit": "Edit system settings"
};
function isValidPermission(perm) {
  if (perm in PERMISSIONS)
    return true;
  if (perm.startsWith("deploy:") && perm !== "deploy:*") {
    return true;
  }
  return false;
}

// src/commands/user-cli.ts
function getPermissionHelp() {
  const lines = [`
Available permissions:`];
  for (const [key, desc] of Object.entries(PERMISSIONS)) {
    lines.push(`  ${key.padEnd(18)} ${desc}`);
  }
  lines.push(`
  deploy:<app>      Deploy specific app (e.g., deploy:my-app)`);
  return lines.join(`
`);
}
function validatePermissions(perms) {
  const invalid = [];
  for (const p of perms) {
    if (!isValidPermission(p)) {
      invalid.push(p);
    }
  }
  return { valid: invalid.length === 0, invalid };
}
var ROLE_PRESETS = {
  viewer: {
    name: "Viewer",
    permissions: ["view:*"],
    description: "Read-only access to dashboard, metrics, logs"
  },
  deployer: {
    name: "Deployer",
    permissions: ["view:*", "deploy:*", "app:restart", "app:rollback"],
    description: "Can deploy, restart, and rollback apps"
  },
  developer: {
    name: "Developer",
    permissions: ["view:*", "deploy:*", "app:*", "github:manage"],
    description: "Full app management including create/delete"
  },
  admin: {
    name: "Admin",
    permissions: ["*"],
    description: "Full access to everything"
  }
};
async function interactivePermissionPicker() {
  const enquirer = await Promise.resolve().then(() => __toESM(require_enquirer(), 1));
  const Select = enquirer.Select || enquirer.default?.Select;
  const MultiSelect = enquirer.MultiSelect || enquirer.default?.MultiSelect;
  const modePrompt = new Select({
    name: "mode",
    message: "How would you like to assign permissions?",
    choices: [
      { name: "viewer", message: "Viewer - Read-only access" },
      { name: "deployer", message: "Deployer - Deploy, restart, rollback" },
      { name: "developer", message: "Developer - Full app management" },
      { name: "admin", message: "Admin - Full access to everything" },
      { name: "custom", message: "Custom - Pick individual permissions" }
    ]
  });
  const mode = await modePrompt.run();
  if (mode !== "custom" && mode in ROLE_PRESETS) {
    const role = ROLE_PRESETS[mode];
    console.log(`
✅ Using ${role.name} preset: ${role.permissions.join(", ")}
`);
    return role.permissions;
  }
  const permChoices = [
    { name: "view:*", message: "view:* - All view permissions", value: "view:*" },
    { name: "apps:view", message: "apps:view - List and view apps", value: "apps:view" },
    { name: "apps:logs", message: "apps:logs - View app logs", value: "apps:logs" },
    { name: "apps:stats", message: "apps:stats - View app stats", value: "apps:stats" },
    { name: "deploy:*", message: "deploy:* - Deploy all apps", value: "deploy:*" },
    { name: "app:*", message: "app:* - All app permissions", value: "app:*" },
    { name: "apps:manage", message: "apps:manage - Start, stop, restart apps", value: "apps:manage" },
    { name: "apps:delete", message: "apps:delete - Remove apps", value: "apps:delete" },
    { name: "github:*", message: "github:* - All GitHub permissions", value: "github:*" },
    { name: "github:import", message: "github:import - Import from GitHub", value: "github:import" },
    { name: "github:webhooks", message: "github:webhooks - Manage webhooks", value: "github:webhooks" },
    { name: "users:manage", message: "users:manage - Manage Linux users", value: "users:manage" },
    { name: "users:access", message: "users:access - Manage access users", value: "users:access" }
  ];
  const permPrompt = new MultiSelect({
    name: "permissions",
    message: "Select permissions (space to toggle, enter to confirm)",
    choices: permChoices,
    initial: ["view:*"],
    hint: "(Use arrow keys, space to select, enter to confirm)"
  });
  const selected = await permPrompt.run();
  if (selected.length === 0) {
    console.log(`
⚠️  No permissions selected, defaulting to view:*
`);
    return ["view:*"];
  }
  console.log(`
✅ Selected: ${selected.join(", ")}
`);
  return selected;
}
function addAccessUserCommands(program2) {
  const user = program2.command("access").description("Access user management (admin only)");
  user.command("add <email>").description("Add a new user with permissions").option("-p, --perm <permission>", "Add permission (can be used multiple times)", collect, []).option("-r, --role <role>", "Use preset role (viewer, deployer, developer, admin)").option("-i, --interactive", "Interactive permission picker").option("-e, --expiry <duration>", "Token expiry (max 24h)", "1d").addHelpText("after", `
Role presets:
  --role viewer     Read-only access to dashboard, metrics, logs
  --role deployer   Can deploy, restart, and rollback apps
  --role developer  Full app management including create/delete
  --role admin      Full access to everything

${getPermissionHelp()}`).action(async (email, options) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can add users");
        process.exit(1);
      }
      let permissions;
      if (options.interactive) {
        permissions = await interactivePermissionPicker();
      } else if (options.role) {
        const rolePreset = ROLE_PRESETS[options.role];
        if (!rolePreset) {
          console.error(`❌ Unknown role: ${options.role}`);
          console.error("   Available: viewer, deployer, developer, admin");
          process.exit(1);
        }
        permissions = rolePreset.permissions;
        console.log(`Using ${options.role} preset: ${permissions.join(", ")}`);
      } else if (options.perm.length > 0) {
        permissions = options.perm;
      } else {
        permissions = ["view:*"];
      }
      const validation = validatePermissions(permissions);
      if (!validation.valid) {
        console.error(`❌ Invalid permissions: ${validation.invalid.join(", ")}`);
        console.error("   Run with --help to see available permissions.");
        process.exit(1);
      }
      const newUser = await addUser(email, permissions);
      console.log(`
✅ User added: ${newUser.email}`);
      console.log(`   Permissions: ${newUser.permissions.join(", ")}`);
      const expiry = options.expiry || "1d";
      const { token, expiresAt } = await generateToken(email, permissions, expiry);
      console.log("Sending welcome email with token...");
      const { sendWelcomeEmail: sendWelcomeEmail2 } = await Promise.resolve().then(() => (init_email(), exports_email));
      const emailResult = await sendWelcomeEmail2(email, token, permissions);
      if (emailResult.success) {
        console.log("✅ Welcome email sent successfully!");
      } else {
        console.error(`⚠️  Failed to send email: ${emailResult.error}`);
        console.log("   Please send the token manually below:");
      }
      console.log(`
Access Token (${options.expiry || "1d"})`);
      console.log("━".repeat(50));
      console.log(`Token: ${token}`);
      console.log("━".repeat(50));
      console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);
      console.log(`
Note: User must this token to login.`);
      if (!emailResult.success)
        console.log("      (Since email failed, you must share this securely manually)");
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  user.command("token <email>").description("Generate an access token for a user").option("-e, --expiry <duration>", "Token expiry (30m, 1h, 1d)", "1d").action(async (email, options) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can generate user tokens");
        process.exit(1);
      }
      const userData = await getUser(email);
      if (!userData) {
        console.error(`❌ User not found: ${email}`);
        console.error("   Create the user first with: okastr8 user add <email>");
        process.exit(1);
      }
      const { token, expiresAt } = await generateToken(email, userData.permissions, options.expiry);
      console.log(`
Token Generated for ${email}
`);
      console.log("━".repeat(50));
      console.log(`Token: ${token}`);
      console.log("━".repeat(50));
      console.log(`
Expires: ${new Date(expiresAt).toLocaleString()}`);
      console.log(`Permissions: ${userData.permissions.join(", ")}
`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  user.command("renew <email>").description("Renew access (generate new token and email it)").option("-e, --expiry <duration>", "Token expiry (max 24h)", "1d").action(async (email, options) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can renew access");
        process.exit(1);
      }
      const userData = await getUser(email);
      if (!userData) {
        console.error(`❌ User not found: ${email}`);
        process.exit(1);
      }
      console.log(`Renewing access for ${email}...`);
      const { token, expiresAt } = await generateToken(email, userData.permissions, options.expiry);
      console.log("Sending new token via email...");
      const { sendWelcomeEmail: sendWelcomeEmail2 } = await Promise.resolve().then(() => (init_email(), exports_email));
      const emailResult = await sendWelcomeEmail2(email, token, userData.permissions);
      if (emailResult.success) {
        console.log("✅ New token emailed successfully!");
      } else {
        console.error(`⚠️  Failed to send email: ${emailResult.error}`);
        console.log("   Please send the token manually below:");
      }
      console.log(`
New Token (${options.expiry})`);
      console.log("━".repeat(50));
      console.log(`Token: ${token}`);
      console.log("━".repeat(50));
      console.log(`Expires: ${new Date(expiresAt).toLocaleString()}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  user.command("list").description("List all users").action(async () => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can list users");
        process.exit(1);
      }
      const users = await listUsers();
      if (users.length === 0) {
        console.log("No users configured. Add one with: okastr8 user add <email>");
        return;
      }
      console.log(`
Users
`);
      console.log("Email".padEnd(30) + "Permissions".padEnd(40) + "Created");
      console.log("─".repeat(85));
      for (const u of users) {
        const perms = u.permissions.slice(0, 3).join(", ") + (u.permissions.length > 3 ? "..." : "");
        const created = new Date(u.createdAt).toLocaleDateString();
        console.log(`${u.email.padEnd(30)}${perms.padEnd(40)}${created}`);
      }
      console.log("");
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  user.command("remove <email>").description("Remove a user and revoke all their tokens").action(async (email) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can remove users");
        process.exit(1);
      }
      const success = await removeUser(email);
      if (success) {
        console.log(`✅ User removed: ${email}`);
        console.log("   All their tokens have been revoked.");
      } else {
        console.error(`❌ User not found: ${email}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  user.command("update <email>").description("Update user permissions").option("-p, --perm <permission>", "Set permissions (can be used multiple times)", collect, []).option("--add <permission>", "Add a permission").option("--remove <permission>", "Remove a permission").addHelpText("after", getPermissionHelp()).action(async (email, options) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can update users");
        process.exit(1);
      }
      const userData = await getUser(email);
      if (!userData) {
        console.error(`❌ User not found: ${email}`);
        process.exit(1);
      }
      let newPerms = [...userData.permissions];
      if (options.perm.length > 0) {
        newPerms = options.perm;
      }
      if (options.add && !newPerms.includes(options.add)) {
        newPerms.push(options.add);
      }
      if (options.remove) {
        newPerms = newPerms.filter((p) => p !== options.remove);
      }
      const updated = await updateUserPermissions(email, newPerms);
      if (updated) {
        console.log(`✅ Updated ${email}`);
        console.log(`   Permissions: ${updated.permissions.join(", ")}`);
        console.log(`
⚠️  User needs a new token for changes to take effect.`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  user.command("info <email>").description("Show user details and permissions").action(async (email) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can view user info");
        process.exit(1);
      }
      const userData = await getUser(email);
      if (!userData) {
        console.error(`❌ User not found: ${email}`);
        process.exit(1);
      }
      const allTokens = await listTokens();
      const userTokens = allTokens.filter((t) => t.userId === email);
      console.log(`
User: ${userData.email}
`);
      console.log(`Created: ${new Date(userData.createdAt).toLocaleString()}`);
      console.log(`Created by: ${userData.createdBy}`);
      console.log(`
Permissions:`);
      for (const p of userData.permissions) {
        console.log(`  • ${p}`);
      }
      if (userTokens.length > 0) {
        console.log(`
Active token:`);
        const t = userTokens[0];
        console.log(`  • ${t.id.slice(0, 12)}... expires ${new Date(t.expiresAt).toLocaleString()}`);
      } else {
        console.log(`
No active token`);
      }
      console.log("");
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  user.command("active").description("List all active access tokens").action(async () => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can view active tokens");
        process.exit(1);
      }
      const tokens = await listTokens();
      if (tokens.length === 0) {
        console.log("No active tokens.");
        return;
      }
      console.log(`
Active Tokens
`);
      console.log("User".padEnd(30) + "Token ID".padEnd(20) + "Expires");
      console.log("─".repeat(75));
      tokens.sort((a, b) => a.userId.localeCompare(b.userId));
      for (const t of tokens) {
        const expires = new Date(t.expiresAt);
        const now = new Date;
        const hoursLeft = Math.round((expires.getTime() - now.getTime()) / 3600000);
        const timeStr = hoursLeft > 24 ? `${Math.floor(hoursLeft / 24)}d left` : `${hoursLeft}h left`;
        console.log(`${t.userId.padEnd(30)}${t.id.slice(0, 12)}...     ${timeStr} (${expires.toLocaleTimeString()})`);
      }
      console.log("");
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  user.command("revoke <email>").description("Revoke active token for a user").action(async (email) => {
    try {
      const isAdmin = await isCurrentUserAdmin();
      if (!isAdmin) {
        console.error("❌ Only admin can revoke tokens");
        process.exit(1);
      }
      const tokens = await listTokens();
      const userToken = tokens.find((t) => t.userId === email);
      if (!userToken) {
        console.error(`⚠️  No active token found for ${email}`);
        return;
      }
      const { revokeToken: revokeToken3 } = await Promise.resolve().then(() => (init_auth(), exports_auth));
      await revokeToken3(userToken.id);
      console.log(`✅ Revoked active token for ${email}`);
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
  });
  user.command("revoke-all").description("Revoke ALL active tokens (Emergency)").action(async () => {
    const readline = await import("readline");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
      rl.question("⚠️  Are you sure you want to REVOKE ALL ACCESS TOKENS? Everyone will be logged out. (y/N): ", resolve);
    });
    rl.close();
    if (answer.toLowerCase() !== "y") {
      console.log("Cancelled.");
      return;
    }
    const { revokeAllTokens: revokeAllTokens2 } = await Promise.resolve().then(() => (init_auth(), exports_auth));
    const count = await revokeAllTokens2();
    console.log(`
✅ Revoked ${count} tokens. All sessions invalidated.`);
  });
}
function collect(value, previous) {
  return previous.concat([value]);
}

// src/commands/tunnel.ts
init_command();
init_config();
import { join as join21, dirname as dirname8 } from "path";
import { fileURLToPath as fileURLToPath7 } from "url";
var __filename8 = fileURLToPath7(import.meta.url);
var __dirname8 = dirname8(__filename8);
var PROJECT_ROOT7 = join21(__dirname8, "..", "..");
var SCRIPTS3 = {
  install: join21(PROJECT_ROOT7, "scripts", "tunnel", "install.sh")
};
async function isCloudflaredInstalled() {
  const result = await runCommand("which", ["cloudflared"]);
  return result.exitCode === 0;
}
async function installTunnel(token) {
  if (!await isCloudflaredInstalled()) {
    console.log("Installing Cloudflared...");
    const installResult = await runCommand("bash", [SCRIPTS3.install]);
    if (installResult.exitCode !== 0) {
      throw new Error(`Failed to install cloudflared: ${installResult.stderr}`);
    }
  }
  console.log("Registering Tunnel Service...");
  await runCommand("sudo", ["cloudflared", "service", "uninstall"]);
  const serviceResult = await runCommand("sudo", ["cloudflared", "service", "install", token]);
  if (serviceResult.exitCode !== 0) {
    throw new Error(`Failed to configure service: ${serviceResult.stderr}`);
  }
  await saveSystemConfig({
    tunnel: {
      enabled: true,
      auth_token: token
    }
  });
  return { success: true, message: "Tunnel installed and started successfully!" };
}
async function uninstallTunnel() {
  console.log("Removing Tunnel Service...");
  const result = await runCommand("sudo", ["cloudflared", "service", "uninstall"]);
  await saveSystemConfig({
    tunnel: {
      enabled: false,
      auth_token: undefined
    }
  });
  return { success: true, message: "Tunnel service removed." };
}
async function getTunnelStatus() {
  if (!await isCloudflaredInstalled()) {
    return { installed: false, running: false };
  }
  const result = await runCommand("systemctl", ["is-active", "cloudflared"]);
  const running = result.stdout.trim() === "active";
  const config = await getSystemConfig();
  return {
    installed: true,
    running,
    configured: !!config.tunnel?.enabled
  };
}
function addTunnelCommands(program2) {
  const tunnel = program2.command("tunnel").description("Manage Cloudflare Tunnel for remote access");
  tunnel.command("setup").description("Install and configure Cloudflare Tunnel").argument("<token>", "Tunnel Token from Cloudflare Dashboard").action(async (token) => {
    console.log("Setting up Cloudflare Tunnel...");
    try {
      const result = await installTunnel(token);
      console.log(result.message);
      console.log("   Your dashboard should now be accessible at your configured domain.");
    } catch (error) {
      console.error("Setup failed:", error.message);
      process.exit(1);
    }
  });
  tunnel.command("uninstall").description("Remove Cloudflare Tunnel service").action(async () => {
    try {
      const result = await uninstallTunnel();
      console.log(result.message);
    } catch (error) {
      console.error("Uninstall failed:", error.message);
      process.exit(1);
    }
  });
  tunnel.command("status").description("Check tunnel status").action(async () => {
    const status = await getTunnelStatus();
    if (!status.installed) {
      console.log("cloudflared is not installed.");
    } else if (status.running) {
      console.log("Tunnel is RUNNING (active).");
    } else {
      console.log("Tunnel is INSTALLED but NOT RUNNING.");
    }
  });
}

// src/commands/system.ts
init_app();
init_systemd();
init_config();
import * as fs from "fs/promises";
import { existsSync as existsSync15 } from "fs";
import * as readline from "readline";
async function controlAllServices(action) {
  console.log(`${action.toUpperCase()}ING all services...`);
  const { apps } = await listApps2();
  if (apps.length === 0) {
    console.log("No apps found.");
    return;
  }
  const results = [];
  for (const app of apps) {
    console.log(`  • ${app.name}...`);
    try {
      if (action === "start")
        await startService2(app.name);
      if (action === "stop")
        await stopService2(app.name);
      if (action === "restart")
        await restartService2(app.name);
      results.push({ name: app.name, success: true });
    } catch (e) {
      console.error(`    ❌ Failed: ${e.message}`);
      results.push({ name: app.name, success: false, error: e.message });
    }
  }
  console.log(`
Operation complete.`);
}
async function nukeSystem() {
  console.clear();
  console.log(`
☢️  WARNING: NUKE PROTOCOL INITIATED ☢️

You are about to DESTROY the entire okastr8 ecosystem on this machine.
This action is IRREVERSIBLE.

The following will happen:
1. All okastr8 applications will be STOPPED and DELETED.
2. All services and containers managed by okastr8 will be REMOVED.
3. The ~/.okastr8 configuration directory will be ERASED.
4. Database, logs, and user data will be LOST FOREVER.
`);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const phrase = "DELETE EVERYTHING";
  const answer = await new Promise((resolve) => {
    rl.question(`To confirm, type exactly "${phrase}": `, resolve);
  });
  rl.close();
  if (answer !== phrase) {
    console.log(`
Confirmation failed. Aborting nuke protocol.`);
    return;
  }
  console.log(`
NUKE CONFIRMED. DESTRUCTION IMMINENT in 5 seconds...`);
  await new Promise((r) => setTimeout(r, 5000));
  console.log(`
Step 1: Destroying Applications...`);
  const { apps } = await listApps2();
  for (const app of apps) {
    process.stdout.write(`  Killing ${app.name}... `);
    try {
      try {
        await stopService2(app.name);
      } catch {}
      try {
        await disableService2(app.name);
      } catch {}
      await deleteApp2(app.name);
      process.stdout.write(`Done
`);
    } catch (e) {
      console.log(`Failed (Ignored): ${e}`);
    }
  }
  console.log(`
Step 2: Stopping Manager Service...`);
  try {
    await stopService2("okastr8-manager");
    await disableService2("okastr8-manager");
  } catch {
    console.log("   (Manager service not running or not found)");
  }
  console.log(`
Step 3: Incinerating Configuration...`);
  if (existsSync15(OKASTR8_HOME)) {
    await fs.rm(OKASTR8_HOME, { recursive: true, force: true });
    console.log(`   Deleted ${OKASTR8_HOME}`);
  }
  console.log(`
SYSTEM NUKED. Okastr8 has been reset to factory application state.`);
}
async function uninstallOkastr8() {
  await nukeSystem();
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         UNINSTALLATION INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The system has been cleaned. To remove the CL tool, run:

  npm uninstall -g okastr8

Or if installed via binary/other package manager, remove the binary manually.

Goodbye!
`);
}
function addSystemCommands(program2) {
  const service = program2.command("service").description("Global service controls");
  service.command("start-all").description("Start all managed services").action(() => controlAllServices("start"));
  service.command("stop-all").description("Stop all managed services").action(() => controlAllServices("stop"));
  service.command("restart-all").description("Restart all managed services").action(() => controlAllServices("restart"));
  const system = program2.command("system").description("System level commands");
  system.command("nuke").description("DANGEROUS: Destroy all apps and data").action(nukeSystem);
  system.command("uninstall").description("Nuke system and show uninstall instructions").action(uninstallOkastr8);
}

// src/main.ts
var program2 = new Command;
program2.name("okastr8").description("CLI for orchestrating server environments and deployments").version("0.0.1");
addSystemdCommands(program2);
addUserCommands(program2);
addOrchestrateCommand(program2);
addSetupCommands(program2);
addAppCommands(program2);
addDeployCommands(program2);
addGitHubCommands(program2);
addMetricsCommands(program2);
addAuthCommands(program2);
addAccessUserCommands(program2);
addTunnelCommands(program2);
addSystemCommands(program2);
program2.parse(process.argv);
