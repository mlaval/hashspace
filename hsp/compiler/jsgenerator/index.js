var TemplateWalker = require("./templateWalker").TemplateWalker;
var processors = require("./processors");
var jsv = require("./jsvalidator/validator");

/**
 * Header added to all generated JS file
 */
var HEADER_ARR = [
        '// ################################################################ ',
        '//  This file has been generated by the hashspace compiler          ',
        '//  Direct MODIFICATIONS WILL BE LOST when the file is recompiled!  ',
        '// ################################################################ ',
        '', 'var hsp=require("hsp/rt");', ''];

var HEADER = module.exports.HEADER = HEADER_ARR.join('\r\n');
var HEADER_SZ = HEADER_ARR.length;

/**
 * Generates the JS compiled string and a list of errors.
 * @param {Object} res the result of the previous steps of the compilation.
 * @param {String} template the template file content as a string.
 * @param {String} dirPath the directory path.
 * @param {String} fileName the name of the file being compiled (optional - used for error messages).
 * @param {Boolean} includeSyntaxTree  if true, the result object will contain the syntax tree generated by the compiler.
 * @param {Boolean} bypassJSvalidation  if true, the validation of the generated JS file (including non-template code) is bypassed - default:false.
 * @return {JSON} a JSON structure with the following properties:
 *      errors: {Array} the error list - each error having the following structure:
 *          description: {String} - a message describing the error 
 *          line: {Number} - the error line number
 *          column: {Number} - the error column number 
 *          code: {String} - a code extract showing where the error occurs (optional)
 *      code: {String} the generated JavaScript code
 *      syntaxTree: {JSON} the syntax tree generated by the parser (optional - cf. parameters)
 *      lineMap: {Array} array of the new line indexes: lineMap[3] returns the new line index for line 4 in
 *          the orginal file (lineMap[0] is always 0 as all line count starts at 1 for both input and output values)
 */
exports.generate = function(res, template, fileName, dirPath, includeSyntaxTree, bypassJSvalidation) {
    res.code = '';
    if (!res.errors || !res.errors.length) {
        // It is sure that res is an array otherwise the parser would have thrown an exception
        var templateWalker = new TemplateWalker(fileName, dirPath);
        var out = templateWalker.walk(res.syntaxTree, processors);

        if (includeSyntaxTree === true) {
            res.codeFragments = templateWalker.templates;
        }

        res.code = HEADER + out.join('\r\n');
        res.errors = templateWalker.errors;
    } else {
        // Generate a JS script to show the errors when the generated file is loaded
        res.code = HEADER;
    }

    if (!res.errors) {
        res.errors = [];
    } else if (res.errors.length > 0) {
        // remove all code so that script can still be loaded
        res.code = HEADER;
    }

    if (res.errors.length === 0 && bypassJSvalidation !== true) {
        var lineMap = _generateLineMap(res, template);
        res.lineMap = lineMap;
        var validationResult = _validate(res.code, lineMap);
        // call the JS validator
        // we don't checke for JS errors when there are template errors as the code generated by the template may be
        // wrong
        if (!validationResult.isValid) {
            // remove all code so that script can still be loaded
            res.code = HEADER;

            Array.prototype.push.apply(res.errors, validationResult.errors);
        }
    }

    res.code += _getErrorScript(res.errors, fileName);

    if (includeSyntaxTree !== true) {
        res.syntaxTree = null;
    }

    return res;
};

/**
 * Validates a javascript string using the jsvalidator module, and generates an error report if not valid.
 * @param {String} code the javascript string.
 * @param {Object} lineMap the line mapping between the source template and the compiled one
 * @return {Object} a result map
 */
function _validate (code, lineMap) {
    var validationResult = jsv.validate(code);
    var result = {isValid: validationResult.isValid};
    if (!validationResult.isValid) {
        // translate error line numbers
        var error, lineNumber;
        for (var i = 0; i < validationResult.errors.length; i++) {
            error = validationResult.errors[i];
            lineNumber = error.line;

            error.line = -1; // to avoid sending a wrong line in case of pb
            for (var j = 0; j < lineMap.length; j++) {
                if (lineMap[j] === lineNumber) {
                    error.line = j; // original line nbr
                    break;
                }
            }
        }
        result.errors = validationResult.errors;
    }
    return result;
}

/**
 * Generate an error script to include in the template compiled script in order to show errors in the browser when the script is loaded
 * @param {Array} errors the errror list
 * @param {String} fileName the name of the file being compiled
 * @return {String} the javascript snippet to be included
 */
function _getErrorScript (errors, fileName) {
    var result = '';
    if (errors && errors.length) {
        result = ['\r\nrequire("hsp/rt").logErrors("', fileName, '",', JSON.stringify(errors, null), ');\r\n'].join("");
    }
    return result;
}

/**
 * Generate the line map of a compilatin result
 * @param {JSON} res the result object of a compilation - cf. compile function
 * @param {String} file the template file (before compilation)
 */
function _generateLineMap (res, file) {
    if (res.errors && res.errors.length) {
        return;
    }
    var syntaxTree = res.syntaxTree, templates = [];
    // identify the templates in the syntax tree
    for (var i = 0; i < syntaxTree.length; i++) {
        if (syntaxTree[i].type === 'template') {
            templates.push(syntaxTree[i]);
        }
    }

    var nbrOfLinesInCompiledTemplate = 5;
    var lineMap = [], pos = HEADER_SZ, template;
    var pos1 = -1; // position of the next template start
    var pos2 = -1; // position of the next template end
    var tplIdx = -1; // position of the current template

    for (var i = 0; i < (file.split(/\n/g).length + 1); i++) {
        if (i === 0 || i === pos2) {
            // end of current template: let's determine next pos1 and pos2
            tplIdx = (i === 0) ? 0 : tplIdx + 1;
            if (tplIdx < templates.length) {
                // there is another template
                template = templates[tplIdx];
                pos1 = template.startLine;
                pos2 = template.endLine;
                if (pos2 < pos1) {
                    // this case should never arrive..
                    pos2 = pos1;
                }
            } else {
                // last template has been found
                tplIdx = pos1 = pos2 = -1;
            }
            if (i === 0) {
                lineMap[0] = 0;
            }
            i++;
        }
        if (i === pos1) {
            for (var j = pos1; j < (pos2 + 1); j++) {
                // all lines are set to the template start
                lineMap[i] = pos;
                i++;
            }
            pos += nbrOfLinesInCompiledTemplate;
            i -= 2; // to enter the i===pos2 clause at next step
        } else {
            lineMap[i] = pos;
            pos++;
        }
    }

    return lineMap;
}