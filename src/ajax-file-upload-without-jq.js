/**
 * require Promise.js
 */
(function () {
    window.ajaxUpload = function (fileSelecter, opts, checkFn, progressFn) {
        var that = this;

        that.defaults = {
            // Location of the server-side upload script
            action: 'upload.php',
            // Additional data to send
            data: {},
            // the max file size(B),default 40M
            //maxFileSize: 41943040
        };

        opts = opts || {};

        for (var p in opts) {
            if (!opts.hasOwnProperty(p)) continue;
            that.defaults[p] = opts[p];
        }

        fileSelecter = document.getElementById(fileSelecter);

        if (!fileSelecter) {
            throw new Error("Please make sure that you're passing a valid element");
        }


        that.fileInput = fileSelecter;
        that.checkFn = checkFn;
        that.progressFn = progressFn;
    };

    ajaxUpload.prototype.upload = function () {
        var that = this;
        var formData = new FormData();
        var files = that.fileInput.files;

        return new Promise(function (resolve, reject) {

            // append files
            for (var i = 0, len = files.length; i < len; i++) {
                if (typeof that.checkFn === "function" && !that.checkFn(files[i])) {
                    reject('checkFn error');
                    return;
                }

                if (that.defaults.maxFileSize && files[i].size > that.defaults.maxFileSize) {
                    reject('size over limit');
                    return;
                }

                formData.append(files[i].name, files[i]);
            }

            //append post data
            if (typeof that.defaults.data == "object") {
                for (var i in that.defaults.data) {
                    formData.append(i, that.defaults.data[i]);
                }
            }

            //do ajax request
            var xhr = new XMLHttpRequest();

            // listen progress event 
            xhr.upload.addEventListener('progress', that.progressFn, false);

            xhr.onload = function (e) {
                if (this.status === 200) {
                    var res;
                    try {
                        res = JSON.parse(this.responseText);
                    } catch (e) {
                        res = this.responseText;
                    }
                    resolve(res);
                } else {
                    reject({
                        msg: 'server error',
                        status: this.status
                    });
                }
            };

            xhr.onerror = function (e) {
                reject(e);
            };

            xhr.open('POST', that.defaults.action, true);
            xhr.send(formData);
        });
    };
})();