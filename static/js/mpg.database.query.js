
/**
 * MongoDB PHP GUI namespace.
 * 
 * @type {object}
 */
var MPG = {};

/**
 * Instance of CodeMirror.
 * 
 * @type {?CodeMirror}
 */
MPG.codeMirror = null;

/**
 * Name of current database.
 * 
 * @type {string}
 */
MPG.databaseName = '';

/**
 * Name of current collection.
 * 
 * @type {string}
 */
MPG.collectionName = '';

/**
 * List of MongoDB keywords.
 * XXX Used for autocompletion.
 * 
 * @type {Array}
 */
MPG.mongoDBKeywords = [

    '$eq', '$gt', '$gte', '$in', '$lt', '$lte', '$ne', '$nin',
    '$and', '$not', '$nor', '$or', '$exists', '$type'

];

/**
 * Field names of current collection.
 * 
 * @type {Array}
 */
MPG.collectionFields = [];

/**
 * Document ID.
 * XXX Used by JsonView parser.
 * 
 * @type {string}
 */
MPG.documentId = '';

/**
 * Type of document ID.
 * XXX Used by JsonView parser.
 * 
 * @type {string}
 */
MPG.documentIdType = '';

/**
 * Initializes CodeMirror instance.
 * 
 * @returns {void}
 */
MPG.initializeCodeMirror = function() {

    MPG.codeMirror = CodeMirror.fromTextArea(
        document.querySelector('#mpg-filter-or-doc-textarea')
    );

};

/**
 * Helpers sub-namespace.
 * 
 * @type {object}
 */
MPG.helpers = {};

/**
 * Does an ajax request.
 * 
 * @param {string} method 
 * @param {string} url 
 * @param {function} successCallback 
 * @param {?string} body
 * 
 * @returns {void}
 */
MPG.helpers.doAjaxRequest = function(method, url, successCallback, body) {

    var xhr = new XMLHttpRequest();

    xhr.addEventListener('readystatechange', function() {

        if ( this.readyState === 4 ) {
            if ( this.status === 200 ) {
                successCallback(this.responseText);
            } else {
                window.alert('Error: ' + JSON.parse(this.responseText).error.message);
            }
        }

    });

    xhr.open(method, url);
    xhr.send(body);

};

/**
 * Converts a string to any type.
 * 
 * @param {string} string 
 * @param {string} targetType
 * 
 * @returns {*}
 * 
 * @throws {Error}
 */
MPG.helpers.convertStringToAny = function(string, targetType) {

    var castedString = string;

    switch (targetType) {

        case 'number':
            castedString = ( string.indexOf('.') !== -1 ) ? parseFloat(string) : parseInt(string);
            if ( isNaN(castedString) ) {
                throw Error('[MongoDB PHP GUI] "' + string + '" is not a number');
            }
            break;

        case 'boolean':
            if ( string === 'true' ) {
                castedString = true;
            } else if ( string === 'false' ) {
                castedString = false;
            } else {
                throw Error('[MongoDB PHP GUI] "' + string + '" is not a boolean');
            }
            break;

        case 'object':
            castedString = ( string === 'null' ) ? null : JSON.parse(string);
            break;

    }

    return castedString;

};

/**
 * Converts any type to a string.
 * 
 * @param {*} any
 * 
 * @returns {*}
 */
MPG.helpers.convertAnyToString = function(any) {

    var string;

    switch (typeof any) {

        case 'object':
            string = ( any === null ) ? 'null' : JSON.stringify(any);
            break;

        case 'number':
        case 'boolean':
        default:
            string = any.toString();
            break;

    }

    return string;

};

/**
 * Reloads collections of a specific database.
 * 
 * @param {string} databaseName
 * 
 * @returns {void}
 */
MPG.reloadCollections = function(databaseName) {

    MPG.helpers.doAjaxRequest(
        'GET', '/ajax/database/' + databaseName + '/listCollections', function(response) {

            var collectionsList = document.querySelector('#mpg-collections-list');

            collectionsList.innerHTML = '';
            MPG.collectionName = '';

            JSON.parse(response).forEach(function(collectionName) {

                collectionsList.innerHTML +=
                    '<li class="collection-name">'
                        + '<i class="fa fa-file-text" aria-hidden="true"></i> '
                        + '<a class="mpg-collection-link" '
                        + 'data-collection-name="' + collectionName
                        + '" href="#' + MPG.databaseName + '/' + collectionName + '">'
                        + collectionName
                        + '</a>'
                    + '</li>';
                
            });

            MPG.eventListeners.addCollections();

        }, null
    );

};

/**
 * Event listeners sub-namespace.
 * 
 * @type {object}
 */
MPG.eventListeners = {};

/**
 * Adds an event listener on each database.
 * 
 * @returns {void}
 */
MPG.eventListeners.addDatabases = function() {

    document.querySelectorAll('.mpg-database-link').forEach(function(databaseLink) {

        databaseLink.addEventListener('click', function(_event) {
            
            MPG.databaseName = databaseLink.dataset.databaseName;
            MPG.reloadCollections(databaseLink.dataset.databaseName);

        });

    });

};

/**
 * Adds an event listener on each collection.
 * 
 * @returns {void}
 */
MPG.eventListeners.addCollections = function() {

    document.querySelectorAll('.mpg-collection-link').forEach(function(collectionLink) {

        collectionLink.addEventListener('click', function(_event) {
            
            MPG.collectionName = collectionLink.dataset.collectionName;
            MPG.collectionFields = [];

            MPG.helpers.doAjaxRequest(
                'GET',
                '/ajax/database/' + MPG.databaseName + '/collection/'
                    + MPG.collectionName + '/enumFields',
                function(response) {

                    JSON.parse(response).forEach(function(collectionField) {
                        if ( typeof collectionField === 'string' ) {
                            MPG.collectionFields.push(collectionField);
                        }
                    });

                },
                null
            );

        });

    });

};

/**
 * Adds an event listener on "Insert one" button.
 * 
 * @returns {void}
 */
MPG.eventListeners.addInsertOne = function() {

    document.querySelector('#mpg-insert-one-button').addEventListener('click', function(_event) {

        if ( MPG.databaseName === '' || MPG.collectionName === '' ) {
            return window.alert('Please select a database and a collection.');
        }

        // Synchronizes CodeMirror with Filter or Document text area.
        MPG.codeMirror.save();

        var requestBody = {};
        var filterOrDocTextAreaValue = document.querySelector('#mpg-filter-or-doc-textarea').value;

        if ( filterOrDocTextAreaValue === '' ) {
            return window.alert('Please fill the document text area.');
        }
        
        requestBody.document = JSON.parse(filterOrDocTextAreaValue);
        
        MPG.helpers.doAjaxRequest(
            'POST',
            '/ajax/database/' + MPG.databaseName + '/collection/'
                + MPG.collectionName + '/insertOne',
            function(response) {

                var outputCode = document.querySelector('#mpg-output-code');
                outputCode.innerHTML = 'Inserted: ' + JSON.parse(response);

            },
            JSON.stringify(requestBody)
        );

    });

};

/**
 * Adds an event listener on "Count" button.
 * 
 * @returns {void}
 */
MPG.eventListeners.addCount = function() {

    document.querySelector('#mpg-count-button').addEventListener('click', function(_event) {

        if ( MPG.databaseName === '' || MPG.collectionName === '' ) {
            return window.alert('Please select a database and a collection.');
        }

        // Synchronizes CodeMirror with Filter or Document text area.
        MPG.codeMirror.save();

        var requestBody = {};
        var filterOrDocTextAreaValue = document.querySelector('#mpg-filter-or-doc-textarea').value;

        if ( filterOrDocTextAreaValue === '' ) {
            requestBody.filter = {};
        } else {
            requestBody.filter = JSON.parse(filterOrDocTextAreaValue);
        }

        MPG.helpers.doAjaxRequest(
            'POST',
            '/ajax/database/' + MPG.databaseName + '/collection/'
                + MPG.collectionName + '/count',
            function(response) {

                var outputCode = document.querySelector('#mpg-output-code');
                outputCode.innerHTML = 'Count: ' + JSON.parse(response);

            },
            JSON.stringify(requestBody)
        );

    });

};

/**
 * Adds an event listener on "Delete one" button.
 * 
 * @returns {void}
 */
MPG.eventListeners.addDeleteOne = function() {

    document.querySelector('#mpg-delete-one-button').addEventListener('click', function(_event) {

        if ( MPG.databaseName === '' || MPG.collectionName === '' ) {
            return window.alert('Please select a database and a collection.');
        }

        // Synchronizes CodeMirror with Filter or Document text area.
        MPG.codeMirror.save();

        var requestBody = {};
        var filterOrDocTextAreaValue = document.querySelector('#mpg-filter-or-doc-textarea').value;

        if ( filterOrDocTextAreaValue === '' ) {
            return window.alert('Please fill the filter text area.');
        }

        var deleteConfirmation = window.confirm(
            'Do you really want to delete document matching this criteria:\n' + filterOrDocTextAreaValue
        )

        if ( deleteConfirmation === false ) {
            return;
        }

        requestBody.filter = JSON.parse(filterOrDocTextAreaValue);
        
        MPG.helpers.doAjaxRequest(
            'POST',
            '/ajax/database/' + MPG.databaseName + '/collection/'
                + MPG.collectionName + '/deleteOne',
            function(response) {

                var outputCode = document.querySelector('#mpg-output-code');
                outputCode.innerHTML = 'Deleted: ' + JSON.parse(response);

            },
            JSON.stringify(requestBody)
        );

    });

};

/**
 * Adds an event listener for updates.
 * 
 * @returns {void}
 */
MPG.eventListeners.addUpdate = function() {

    var updatableJsonValues = document.querySelectorAll(
        '.json-value[data-document-field-is-updatable="true"]'
    );

    updatableJsonValues.forEach(function(updatableJsonValue) {

        updatableJsonValue.addEventListener('click', function(event) {

            var documentFieldNewValue = window.prompt('New value');

            if ( documentFieldNewValue === null ) {
                return;
            }

            var documentField = event.currentTarget;

            documentFieldNewValue = MPG.helpers.convertStringToAny(
                documentFieldNewValue, documentField.dataset.documentFieldType
            );

            if ( MPG.documentIdType === 'int' ) {
                var documentId = parseInt(documentField.dataset.documentId);
            } else {
                var documentId = documentField.dataset.documentId;
            }

            var requestBody = { 
                "filter": {
                    "_id": documentId
                },
                "update": {
                    "$set": {}
                }
            };

            requestBody.update.$set[documentField.dataset.documentFieldName] = documentFieldNewValue;

            MPG.helpers.doAjaxRequest(
                'POST',
                '/ajax/database/' + MPG.databaseName + '/collection/'
                    + MPG.collectionName + '/updateOne',
                function(response) {

                    if ( JSON.parse(response) === 1 ) {
                        documentField.innerText = MPG.helpers.convertAnyToString(
                            documentFieldNewValue
                        );
                    }

                },
                JSON.stringify(requestBody)
            );

        });

    })

};

/**
 * Adds an event listener on "Find" button.
 * 
 * @returns {void}
 */
MPG.eventListeners.addFind = function() {

    document.querySelector('#mpg-find-button').addEventListener('click', function(_event) {

        if ( MPG.databaseName === '' || MPG.collectionName === '' ) {
            return window.alert('Please select a database and a collection.');
        }

        // Synchronizes CodeMirror with Filter or Document text area.
        MPG.codeMirror.save();

        var requestBody = {};
        var filterOrDocTextAreaValue = document.querySelector('#mpg-filter-or-doc-textarea').value;

        if ( filterOrDocTextAreaValue === '' ) {
            requestBody.filter = {};
        } else {
            requestBody.filter = JSON.parse(filterOrDocTextAreaValue);
        }

        requestBody.options = {};
        requestBody.options.limit = parseInt(document.querySelector('#mpg-limit-input').value);

        MPG.helpers.doAjaxRequest(
            'POST',
            '/ajax/database/' + MPG.databaseName + '/collection/'
                + MPG.collectionName + '/find',
            function(response) {

                var outputCode = document.querySelector('#mpg-output-code');
                outputCode.innerHTML = '';

                var jsonViewTree = JsonView.createTree(response);
                JsonView.render(jsonViewTree, outputCode);
                JsonView.expandChildren(jsonViewTree);
                MPG.documentId = '';

                MPG.eventListeners.addUpdate();

            },
            JSON.stringify(requestBody)
        );

    });

};

/**
 * Adds an event listener for autocompletion.
 * 
 * @returns {void}
 */
MPG.eventListeners.addCtrlSpace = function() {

    document.addEventListener('keydown', function(event) {
        if ( event.ctrlKey && event.code == 'Space' ) {
            MPG.codeMirror.showHint();
        }
    });

};

// When document is ready:
window.addEventListener('DOMContentLoaded', function(_event) {

    MPG.initializeCodeMirror();

    MPG.eventListeners.addDatabases();
    MPG.eventListeners.addInsertOne();
    MPG.eventListeners.addCount();
    MPG.eventListeners.addDeleteOne();
    MPG.eventListeners.addFind();
    MPG.eventListeners.addCtrlSpace();

    window.location.hash = '';

});