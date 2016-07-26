// Ajax File upload with jQuery and XHR2
// Sean Clark http://square-bracket.com
// xhr2 file upload
$.fn.upload = function (options, checkFn, progressFn) {

    this._settings = {
        // Location of the server-side upload script
        action: 'upload.php',
        // Additional data to send
        data: {},
        // the max file size(B),default 40M
        //maxFileSize: 41943040
    };

    // Merge the users options with our defaults
    for (var i in options) {
        if (options.hasOwnProperty(i)) {
            this._settings[i] = options[i];
        }
    }

    var def = new $.Deferred();
    var formData = new FormData();

    var files = this[0].files;
    var numFiles = files.length;
    for (var i = 0; i < numFiles; i++) {

        if (typeof checkFn === "function" && !checkFn(files[i])) {
            def.reject({
                code: 'checkFn error',
                message: 'checkFn error (' + files[i].name + ').'
            });
            return def.promise();
        }

        // Check whether the file size limit is reached.
        if (this._settings.maxFileSize && files[i].size > this._settings.maxFileSize) {
            def.reject({
                code: 'size over limit',
                message: 'The size of file(' + files[i].name + ') over the limit.'
            });
            return def.promise();
        }

        formData.append(files[i].name, files[i]);
    }

    // if we have post data too
    if (typeof this._settings.data == "object") {
        for (var i in this._settings.data) {
            formData.append(i, this._settings.data[i]);
        }
    }

    if (numFiles > 0) {
        // do the ajax request
        $.ajax({
            url: this._settings.action,
            type: "POST",
            xhr: function () {
                myXhr = $.ajaxSettings.xhr();
                if (myXhr.upload && progressFn) {
                    myXhr.upload.addEventListener("progress", function (prog) {
                        var value = ~~((prog.loaded / prog.total) * 100);

                        // if we passed a progress function
                        if (typeof progressFn === "function") {
                            progressFn(prog, value);

                            // if we passed a progress element
                        } else if (progressFn) {
                            $(progressFn).val(value);
                        }
                    }, false);
                }
                return myXhr;
            },
            data: formData,
            dataType: "json",
            cache: false,
            contentType: false,
            processData: false,
            success: function (data) {
                def.resolve(data);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                def.reject(jqXHR);
            },
            complete: function () {
            }
        });
    } else {
        def.reject({
            code: 'no files',
            message: 'The number of files cannot be empty.'
        });
    }

    return def.promise();
};
