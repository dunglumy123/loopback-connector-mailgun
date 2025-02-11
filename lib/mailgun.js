var Mailgun = require('mailgun-js'),
    Promise = require('bluebird'),
    lo = require('lodash'),
    path = require('path'),
    fs = require('fs'),
    mime = require('mime');

module.exports = Connector;

/**
 * Configure and create an instance of the connector
 */

function Connector(settings) {
    this.mailgun = Mailgun({apiKey: settings.apikey, domain: settings.domain, host: settings.host || null});
}

Connector.initialize = function (dataSource, callback) {

    dataSource.connector = new Connector(dataSource.settings);
    callback();
};

Connector.prototype.DataAccessObject = Mailer;

function Mailer() {

}

Mailer.send = function (options, callback) {
    var _this = this;

    return new Promise(function (resolve, reject) {
        var dataSource = _this.dataSource,
            settings = dataSource && dataSource.settings,
            connector = dataSource.connector,
            mailgunMessage = {};

        if (options.__data) {
            options = lo.clone(options.__data);
        }
        else {
            options = lo.clone(options);
        }

        var fn = function (err, result) {
            if (err) {
                if (callback){
                    callback(err);
                }
                return reject(err);
            }

            if (callback){
                callback();
            }

            return resolve(result);
        };

        if (lo.isString(options.from)) {
            mailgunMessage.from = options.from
        } else if (lo.isObject(options.from)) {
            mailgunMessage.from = options.from.name + '<' + options.from.email + '>';
        } else {
            var from = [];
            if (options.from_name) {
                from.push(options.from_name || undefined);
            }
            if (options.from) {
                from.push('<' + options.from + '>' || undefined);
            }
            mailgunMessage.from = from;
        }
        delete options.from;

        if (lo.isString(options.to)) {
            mailgunMessage.to = options.to;
        } else if (lo.isArray(options.to)) {
            mailgunMessage.to = options.to;
        } else if (lo.isObject(options.to)) {
            mailgunMessage.to = options.to.name + '<' + options.to.email + '>';
        } else {
            mailgunMessage.to = options.to;
        }
        delete options.to;


        if (lo.isObject( options['recipient-variables'] )) {
          mailgunMessage['recipient-variables'] = options['recipient-variables'];
        }


        mailgunMessage.subject = options.subject || null;
        mailgunMessage.html = options.html || undefined;
        mailgunMessage.text = options.text || undefined;

        if(options.cc) {
            mailgunMessage.cc = options.cc;
        }

        if(options.bcc) {
            mailgunMessage.bcc = options.bcc;
        }

        if (options.replyTo) {
            mailgunMessage['h:Reply-To'] = options.replyTo;
        }

        if (options.attachments) {
            mailgunMessage.attachment = [];

            if (lo.isString(options.attachments) || lo.isObject(options.attachments)) {
                mailgunMessage.attachment.push(_this.createAttachment(options.attachments));
            } else if (lo.isArray(options.attachments)) {
                for (var i in options.attachments) {
                    mailgunMessage.attachment.push(_this.createAttachment(options.attachments[i]));
                }
            }
        }

        if (options.options) {
            lo.forEach(options.options, function (value, key) {
                mailgunMessage['o:' + key] = value;
            });
        }

        if (options.var) {
            lo.forEach(options.var, function (value, key) {
                mailgunMessage['v:' + key] = value;
            });
        }

        if (options.headers) {
            lo.forEach(options.headers, function (value, key) {
                mailgunMessage['h:' + key] = value;
            });
        }
        
        connector.mailgun.messages().send(mailgunMessage, function (err, body) {
            fn(null, body);
        }, function (err) {
            fn(err, null);
        });
    });
};

Mailer.createAttachment = function (file) {
    if (typeof file == 'string') {
        return this.createFileStream(file);
    } else { //assume buffer
        //has to be something like {data: buffer, filename: "attachment.pdf",contentType: 'application/pdf'}
        return new this.dataSource.connector.mailgun.Attachment(file);
    }
};

Mailer.createFileStream = function (file) {
    var fileStream = fs.createReadStream(file);
    var fileStat = fs.statSync(file);

    return new this.dataSource.connector.mailgun.Attachment({
        data: fileStream,
        filename: path.basename(file),
        knownLength: fileStat.size,
        contentType: mime.getType(file)
    });
};

/**
 * Send an email instance using instance
 */
Mailer.prototype.send = function (fn) {
    return this.constructor.send(this, fn);
};

Mailer.build = function (callback) {
    this.mail.build(function (mailBuildError, message) {

        callback(mailBuildError, message);
    });
};
