var klass = require("../../klass");

var ClassHandler = klass({
    $constructor : function (nodeInstance) {
        this.nodeInstance = nodeInstance;
        this.previousClasses = null;
    },

    _pushValue: function(value, list) {
        //Determines at which index to push the class
        list.push(value);
    },

    setValue: function (name, newClasses) {
        var currentClasses = this.nodeInstance.node.className;
        var currentClassesArray = currentClasses? currentClasses.split(' '): [];
        var results = [];
        //Simple case: the output of the expression is a string
        if (newClasses && typeof(newClasses) === 'string') {
            results = currentClassesArray;
            var insertionIndex = -1;
            if (this.previousClasses) {
                var previousClassesArray = this.previousClasses.split(' ');
                for (var i = 0; i < previousClassesArray.length; i++) {
                    var index = results.indexOf(previousClassesArray[i]);
                    if (index > -1) {
                        results.splice(index, 1);
                        if (insertionIndex === -1) {
                            insertionIndex = index;
                        }
                    }
                }
            }
            results.splice(insertionIndex > -1? insertionIndex: 0, 0, newClasses);
            this.previousClasses = newClasses;
        }
        //Advanced case: the output of the expression is an object or an array with expressions
        else {
            if (!newClasses || newClasses.constructor !== Array) {
                newClasses = [newClasses];
            }
            //Builds the list of all classes from the template
            for (var i = 0; i < newClasses.length; i++) {
                var newClass = newClasses[i];
                if (Object.prototype.toString.apply(newClass) === "[object Object]") {
                    for (var key in newClass) {
                        results.push(key);
                    }
                }
                else {
                    results.push(newClasses[i]);
                }
            }

            //Based on previous className value, insert extra classes at the best position
            var extras = [];
            for (var j = 0; j < currentClassesArray.length; j++) {
                var currentClass = currentClassesArray[j];
                if (results.indexOf(currentClass) === -1) {
                    extras.push(currentClass);
                }
                else {
                    if (extras.length > 0) {
                        Array.prototype.splice.apply(results, [results.indexOf(currentClass), 0].concat(extras));
                        extras = [];
                    }
                }
            }
            if (extras.length > 0) {
                Array.prototype.splice.apply(results, [results.length, 0].concat(extras));
            }
            
            //Remove classes which are off because of the expression
            for (var k = 0; k < newClasses.length; k++) {
                var newClass = newClasses[k];
                if (Object.prototype.toString.apply(newClass) === "[object Object]") {
                    for (var key in newClass) {
                        var index = results.indexOf(key);
                        if (!newClass[key] && index > -1) {
                            results.splice(index, 1);
                        }
                    }
                }
            }
        }
        
        //Add generated className to the element (issue on IE8 with the class attribute?)
        if (this.nodeNS) {
            this.nodeInstance.node.setAttribute("class", results.join(' '));
        } else {
            this.nodeInstance.node.className = results.join(' ');
        }
    },

    $dispose: function() {
        this.previousClasses = null;
    }
});

module.exports = ClassHandler;