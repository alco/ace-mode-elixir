function format(str) {
"use strict";

    var args = Array.prototype.slice.call(arguments, 1);
    return str.replace(/{(\d+)}/g, function(match, number) {
        return typeof args[number] !== 'undefined' ? args[number] : match;
    });
}

function escape_regex(string) {
"use strict";

  return string.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
}

function map(array, f) {
"use strict";

    var new_array = [];
    for (var i = 0; i < array.length; i++) {
        new_array.push(f.(array[i]));
    }
    return new_array;
}

function gen_elixir_string_rules(name, symbol, token) {
"use strict";

    states = {}
    states['string_' + name] = [
        {
            token: token,
            regex: format('[^#{0}\\\\]+', symbol),
        },
        include('escapes'),
        {
            token: token,
            regex: '\\\\.',
        },
        {
            token: [token],
            regex: format('({0})', symbol),
            next: "pop",
        },
        include('interpol')
    ]
    return states;
}

function gen_elixir_sigstr_rules(term, token, interpol) {
"use strict";
    if (interpol === undefined) interpol = true;
    if (interpol) {
        return [
            {
                token: token,
                regex: format('[^#{0}\\\\]+', term),
            },
            include('escapes'),
            {
                token: token,
                regex: '\\\\.',
            },
            {
                token: token,
                regex: format('{0}[a-zA-Z]*', term),
                next: 'pop',
            },
            include('interpol')
        ];
    } else {
        return [
            {
                token: token,
                regex: format('[^{0}\\\\]+', term),
            },
            {
                token: token,
                regex: '\\\\.',
            },
            {
                token: token,
                regex: format('{0}[a-zA-Z]*', term),
                next: 'pop',
            },
        ];
    }
}

define(function(require, exports, module) {
"use strict";

var ElixirHighlightRules = function() {

    var keywordMapper = this.$keywords = this.createKeywordMapper({
        "keyword": keywords,
        "constant.language": buildinConstants,
        "variable.language": builtinVariables,
        "support.function": builtinFunctions,
        "invalid.deprecated": "debugger" // TODO is this a remnant from js mode?
    }, "identifier");

    // regexp must not have capturing parentheses. Use (?:) instead.
    // regexps are ordered -> the first match is used

    var KEYWORD = ['fn', 'do', 'end', 'after', 'else', 'rescue', 'catch'];
    var KEYWORD_OPERATOR = ['not', 'and', 'or', 'when', 'in'];
    var BUILTIN = [
        'case', 'cond', 'for', 'if', 'unless', 'try', 'receive', 'raise',
        'quote', 'unquote', 'unquote_splicing', 'throw', 'super'
    ];
    var BUILTIN_DECLARATION = [
        'def', 'defp', 'defmodule', 'defprotocol', 'defmacro', 'defmacrop',
        'defdelegate', 'defexception', 'defstruct', 'defimpl', 'defcallback'
    ];

    var BUILTIN_NAMESPACE = ['import', 'require', 'use', 'alias'];
    var CONSTANT = ['nil', 'true', 'false'];

    var PSEUDO_VAR = ['_', '__MODULE__', '__DIR__', '__ENV__', '__CALLER__'];

    var OPERATORS3 = ['<<<', '>>>', '|||', '&&&', '^^^', '~~~', '===', '!=='];
    var OPERATORS2 = [
        '==', '!=', '<=', '>=', '&&', '||', '<>', '++', '--', '|>', '=~',
        '->', '<-', '|', '.', '='
    ];
    var OPERATORS1 = ['<', '>', '+', '-', '*', '/', '!', '^', '&'];

    var PUNCTUATION = [
        '\\\\', '<<', '>>', '=>', '(', ')', ':', ';', ',', '[', ']'
    ];

    var op3_re = map(OPERATORS3, escape_regex).join("|");
    var op2_re = map(OPERATORS2, escape_regex).join("|");
    var op1_re = map(OPERATORS1, escape_regex).join("|");
    var ops_re = format('(?:{0}|{1}|{2})', op3_re, op2_re, op1_re);
    var punctuation_re = map(PUNCTUATION, escape_regex).join("|");
    var alnum = '[A-Za-z_0-9]';
    var name_re = format('[a-z_]{0}*[!\\?]?', alnum);
    var modname_re = format('[A-Z]{0}*(?:\\.[A-Z]{0}*)*', alnum);
    var complex_name_re = format('(?:{0}|{1}|{2})', name_re, modname_re, ops_re);
    var special_atom_re = '(?:\\.\\.\\.|<<>>|%{}|%|{})';

    var long_hex_char_re = '(\\\\x{)([\\da-fA-F]+)(})';
    var hex_char_re = '(\\\\x[\\da-fA-F]{1,2})';
    var escape_char_re = '(\\\\[abdefnrstv])';

    this.$rules = {
        'start': [
            {
                token: 'text',
                regex: '\\s+',
            },
            {
                token: 'comment',  // single-line comment
                regex: '#.*$',
            },

            // Various kinds of characters
            {
                token: ['constant.character', 'constant.numeric', 'constant.character.escape'],
                regex: '(\\?)' + long_hex_char_re,
            },
            {
                token: ['constant.character', 'constant.character.escape'],
                regex: '(\\?)' + hex_char_re,
            },
            {
                token: ['constant.character', 'constant.character.escape'],
                regex: '(\\?)' + escape_char_re,
            },
            {
                token: 'constant.character',
                regex: '\\?\\\\?.',
            },

            // '::' has to go before atoms
            {
                token: 'constant.other.symbol.ruby',
                regex: ':::',
            },
            {
                token: 'keyword.operator',
                regex: '::',
            },

            // atoms
            {
                token: 'constant.other.symbol.ruby',
                regex: ':' + special_atom_re,
            },
            {
                token: 'constant.other.symbol.ruby',
                regex: ':' + complex_name_re,
            },
            {
                token: 'constant.other.symbol.ruby',
                regex: ':"',
                next: 'string_double_atom',
            },
            {
                token: 'constant.other.symbol.ruby',
                regex: ":'",
                next: 'string_single_atom',
            },

            // [keywords: ...]
            {
                token: ['constant.other.symbol.ruby', 'punctuation'],
                regex: format('({0}|{1})(:)(?=\\s|\\n)', special_atom_re, complex_name_re),
            },

            // @attributes
            {
                token: 'identifier.attribute',
                regex: '@' + name_re,
            },

            // operators and punctuation
            {
                token: 'keyword.operator',
                regex: op3_re,
            },
            {
                token: 'keyword.operator',
                regex: op2_re,
            },
            {
                token: 'punctuation',
                regex: punctuation_re,
            },
            {
                token: 'constant.character.entity',
                regex: '&\\d',  // anon func arguments
            },
            {
                token: 'keyword.operator',
                regex: op1_re,
            },

            // identifiers
            {
                token: 'identifier',
                regex: name_re,
            },
            {
                token: ['punctuation', 'support.class'],
                regex: format('(%?)({0})', modname_re),
            },

            // numbers
            {
                token: 'constant.numeric',  // binary
                regex: '0b[01]+',
            },
            {
                token: 'constant.numeric',  // octal
                regex: '0o[0-7]+',
            },
            {
                token: 'constant.numeric',  // hexadecimal
                regex: '0x[\\da-fA-F]+',
            },
            {
                token: 'constant.numeric',  // float
                regex: '\\d(_?\\d)*\\.\\d(_?\\d)*([eE][-+]?\\d(_?\\d)*)?',
            },
            {
                token: 'constant.integer',  // integer
                regex: '\\d(_?\\d)*',
            },

            // strings and heredocs
            {
                token: 'heredoc',
                regex: '"""\s*',
                next: 'heredoc_double',
            },
            {
                token: 'heredoc',
                regex: "'''\\s*$",
                next: 'heredoc_single',
            },
            {
                token: 'string',
                regex: '"',
                next: 'string_double',
            },
            {
                token: 'string',
                regex: "'",
                next: 'string_single',
            },

            include('sigils'),

            {
                token: 'punctuation',
                regex: '%{',
                next: 'map_key',
            },
            {
                token: 'punctuation',
                regex: '{',
                next: 'tuple',
            },
        ],
        'heredoc_double': [
            {
                token: 'heredoc',
                regex: '^\\s*"""',
                next: 'pop',
            },
            include('heredoc_interpol'),
        ],
        'heredoc_single': [
            {
                token: 'heredoc',
                regex: "^\\s*'''",
                next: 'pop',
            },
            include('heredoc_interpol'),
        ],
        'heredoc_interpol': [
            {
                token: 'heredoc',
                regex: '[^#\\\\\n]+',
            },
            include('escapes'),
            {
                token: 'heredoc',
                regex: '\\\\.',
            },
            {
                token: 'heredoc',
                regex: '\n+',
            },
            include('interpol'),
        ],
        'heredoc_no_interpol': [
            {
                token: 'heredoc',
                regex: '[^\\\\\n]+',
            },
            {
                token: 'heredoc',
                regex: '\\\\.',
            },
            {
                token: 'heredoc',
                regex: '\n+',
            },
        ],
        'escapes': [
            {
                token: ['constant.character.escape', 'constant.numeric', 'constant.character.escape'],
                regex: long_hex_char_re,
            },
            {
                token: 'constant.character.escape',
                regex: hex_char_re,
            },
            {
                token: 'constant.character.escape',
                regex: escape_char_re,
            },
        ],
        'interpol': [
            {
                token: 'interpol',
                regex: '#{',
                next: 'interpol_string',
            },
        ],
        'interpol_string' : [
            {
                token: 'interpol',
                regex: '}',
                next: "pop",
            },
            include('start')
        ],
        'map_key': [
            include('start'),
            {
                token: 'punctuation',
                regex: ':',
                next: 'map_val',
            },
            {
                token: 'punctuation',
                regex: '=>',
                next: 'map_val',
            },
            {
                token: 'punctuation',
                regex: '}',
                next: 'pop',
            },
        ],
        'map_val': [
            include('start'),
            {
                token: 'punctuation',
                regex: ',',
                next: 'pop',
            },
            {
                token: 'punctuation',
                regex: '(?=})',
                next: 'pop',
            },
        ],
        'tuple': [
            include('start'),
            {
                token: 'punctuation',
                regex: '}',
                next: 'pop',
            },
        ],
    };
    tokens.update(gen_elixir_string_rules('double', '"', String.Double))
    tokens.update(gen_elixir_string_rules('single', "'", String.Single))
    tokens.update(gen_elixir_string_rules('double_atom', '"', String.Symbol))
    tokens.update(gen_elixir_string_rules('single_atom', "'", String.Symbol))
    tokens.update(gen_elixir_sigil_rules())

    this.normalizeRules();
};

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
oop.inherits(ElixirHighlightRules, TextHighlightRules);

exports.ElixirHighlightRules = ElixirHighlightRules;
});
