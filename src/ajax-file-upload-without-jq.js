/**
 * require Promise.js,exif.js,jpeg_encoder_basic.js
 */
(function (window) {
    window.URL = window.URL || window.webkitURL;

    var UA = (function (userAgent) {
        var ISOldIOS = /OS (\d)_.* like Mac OS X/g.exec(userAgent),
            isOldAndroid = /Android (\d.*?);/g.exec(userAgent) || /Android\/(\d.*?) /g.exec(userAgent);

        // 判断设备是否是IOS7以下
        // 判断设备是否是android4.5以下
        // 判断是否iOS
        // 判断是否android
        // 判断是否QQ浏览器
        return {
            oldIOS: ISOldIOS ? +ISOldIOS.pop() < 8 : false,
            oldAndroid: isOldAndroid ? +isOldAndroid.pop().substr(0, 3) < 4.5 : false,
            iOS: /\(i[^;]+;( U;)? CPU.+Mac OS X/.test(userAgent),
            android: /Android/g.test(userAgent),
            mQQBrowser: /MQQBrowser/g.test(userAgent)
        }
    })(navigator.userAgent);

    /**
     * 转换成formdata
     * @param dataURI
     * @returns {*}
     *
     * @source http://stackoverflow.com/questions/4998908/convert-data-uri-to-file-then-append-to-formdata
     */
    function dataURItoBlob(dataURI) {
        // convert base64/URLEncoded data component to raw binary data held in a string
        var byteString;
        if (dataURI.split(',')[0].indexOf('base64') >= 0)
            byteString = atob(dataURI.split(',')[1]);
        else
            byteString = unescape(dataURI.split(',')[1]);

        // separate out the mime component
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

        // write the bytes of the string to a typed array
        var ia = new Uint8Array(byteString.length);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        return new Blob([ia], { type: mimeString });
    }

    // 使用canvas将file转成base64,并fix ios图片旋转问题
    function _getBase64(file) {

        var that = this;
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        var image = new Image();
        var orientation;

        if (!document.createElement('canvas').getContext) {
            throw new Error('浏览器不支持canvas');
        }

        EXIF.getData(file, function () {
            orientation = EXIF.getTag(this, "Orientation");
            //alert(orientation);
        });


        return new Promise(function (resolve, reject) {

            image.onload = function () {

                var resize = _getResize(this, orientation);

                canvas.width = resize.width;
                canvas.height = resize.height;

                var base64 = null;

                // 调整为正确方向
                switch (orientation) {
                    case 3:
                        ctx.rotate(180 * Math.PI / 180);
                        ctx.drawImage(this, -canvas.width, -canvas.height, canvas.width, canvas.height);
                        break;
                    case 6:
                        ctx.rotate(90 * Math.PI / 180);
                        ctx.drawImage(this, 0, -canvas.width, canvas.height, canvas.width);
                        break;
                    case 8:
                        ctx.rotate(270 * Math.PI / 180);
                        ctx.drawImage(this, -canvas.height, 0, canvas.height, canvas.width);
                        break;

                    case 2:
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        ctx.drawImage(this, 0, 0, canvas.width, canvas.height);
                        break;
                    case 4:
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        ctx.rotate(180 * Math.PI / 180);
                        ctx.drawImage(this, -canvas.width, -canvas.height, canvas.width, canvas.height);
                        break;
                    case 5:
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        ctx.rotate(90 * Math.PI / 180);
                        ctx.drawImage(this, 0, -canvas.width, canvas.height, canvas.width);
                        break;
                    case 7:
                        ctx.translate(canvas.width, 0);
                        ctx.scale(-1, 1);
                        ctx.rotate(270 * Math.PI / 180);
                        ctx.drawImage(this, -canvas.height, 0, canvas.height, canvas.width);
                        break;

                    default:
                        ctx.drawImage(this, 0, 0, canvas.width, canvas.height);
                }

                // createBase64
                base64 = _createBase64(canvas, ctx);

                resolve(dataURItoBlob(base64));

                //canvas.toBlob(function (blob) {
                //    resolve(blob);
                //}, "image/jpeg", 0.95);
            };

            image.src = URL.createObjectURL(file);
        });
    }

    function _getOrientation(file) {
        return new Promise(function (resolve, reject) {
            EXIF.getData(file, function () {
                orientation = EXIF.getTag(this, "Orientation");
                resolve(orientation);
            });
        });
    }

    function _createBase64(canvas, ctx) {
        var base64 = null;
        if (UA.oldAndroid || UA.mQQBrowser || !navigator.userAgent) {
            var encoder = new JPEGEncoder();
            base64 = encoder.encode(ctx.getImageData(0, 0, canvas.width, canvas.height), 80);
        }
        else {
            base64 = canvas.toDataURL('image/jpeg', 0.8);
        }
        return base64;
    }


    function _getResize(img, orientation) {
        var ret = {
            width: img.width,
            height: img.height
        };

        // 修正图片旋转90度情况
        if ("5678".indexOf(orientation) > -1) {
            ret.width = img.height;
            ret.height = img.width;
        }

        // 超过这个值base64无法生成，在IOS上
        while (ret.width >= 3264 || ret.height >= 2448) {
            ret.width *= 0.8;
            ret.height *= 0.8;
        }

        return ret;
    }


    window.ajaxUpload = function (fileSelecter, opts, checkFn, progressFn) {
        var that = this;

        that.defaults = {
            // Location of the server-side upload script
            action: 'upload.php',
            // Additional data to send
            data: {},
            errorMsg: {
                FILE_EMPTY: 'The number of files cannot be empty.',
                VALIDATION_FAILS: 'Custom validation fails',
                SIZE_OVER_LIMIT: 'size over limit'
            }
            // the max file size(B),default 40M
            //maxFileSize: 41943040
        };

        that.size = {
            original: null,
            compressed: null
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
        that.canvas = document.createElement("canvas");
    };

    ajaxUpload.prototype._verify = function () {
        var that = this;
        var files = that.fileInput.files;

        if (files.length < 1) {
            return {
                status: 0,
                msg: that.defaults.errorMsg.FILE_EMPTY
            };
        }

        if (typeof that.checkFn === "function" && !that.checkFn(files[0])) {
            return {
                status: 0,
                msg: that.defaults.errorMsg.VALIDATION_FAILS
            };
        }

        if (that.defaults.maxFileSize && files[0].size > that.defaults.maxFileSize) {
            return {
                status: 0,
                msg: that.defaults.errorMsg.SIZE_OVER_LIMIT
            };
        }

        return {
            status: 1,
            msg: ''
        };
    };

    ajaxUpload.prototype.upload = function () {
        var that = this;
        var formData = new FormData();
        var files = that.fileInput.files;

        return new Promise(function (resolve, reject) {

            // append files
            var verify_res = that._verify();

            if (verify_res.status !== 1) {
                reject(new Error(verify_res.msg));
                return;
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
                    reject(new Error('server error'));
                }
            };

            xhr.onerror = function (e) {
                reject(new Error('xhr error'));
            };

            xhr.open('POST', that.defaults.action, true);

            // 上传文件原始大小
            that.size.original = that.fileInput.files[0].size;

            // file to base64 and fix ios picture orientation
            _getBase64(files[0]).then(function (value) {
                formData.append(files[0].name, value);

                that.size.compressed = value.size;
                xhr.send(formData);
            });
        });
    };
})(window);