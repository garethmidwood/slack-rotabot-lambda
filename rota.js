const aws = require('aws-sdk');
const docClient = new aws.DynamoDB.DocumentClient({region: 'eu-west-2'});

class rota {
    constructor(message) {
        this.rotas = {};
        this.message = message;

        console.log('constructing rota');
    }
    /*
     * Returns the first word from a string
     */
    getFirstWord(text) {
        return text.match(/^[^\s]+/i) ? text.match(/^[^\s]+/i)[0] : '';
    }

    /*
     * Returns the number of weekdays between 2 dates
     */
    countWeekdaysBetweenDates(first, last) {
        if (first > last) return -1;

        var start = new Date(first.getTime());
        var end = new Date(last.getTime());
        var count = 0;
        
        while (start <= end) {
            if (start.getDay() != 0 && start.getDay() != 6) {
                count++;
            } 

            start.setDate(start.getDate() + 1);
        }

        return count;
    }

    /*
     * Returns the person on rota based on a Mon - Fri schedule
     */
    getWeekdayRota(rotaArray) {
        var a = new Date('03/01/2019');
        var b = new Date();

        var noOfWeekdays = this.countWeekdaysBetweenDates(a, b);

        var index = noOfWeekdays % rotaArray.length;

        return rotaArray[index];
    }

    /*
     * Directs rota requests to the correct handler function
     */
    process(awesomeCallback) {
        console.log('called rota process() function');
        var subCommand = this.getFirstWord(this.message.text);
        var args = this.message.text.replace(subCommand, '').trim();

        var params = {
            TableName: 'slack-rotabot',
            Key: {
                "team_id": this.message.originalRequest.team_id
            }
        }

        var DDBRequestPromise = docClient.get(params).promise();

        var oRota = this;
        var originalMessage = this.message;

        return Promise.all([DDBRequestPromise]).then(function(data) {
            console.log('setting the rotas up in DDB Request Promise');
            console.log(data);
            oRota.rotas = data[0].Item.message;

            console.log('now called DDBRequestPromise.then');
            var response = '';
            
            switch(subCommand) {
                case 'create':
                    response = oRota.rotaCreate(args);
                break;
                case 'delete':
                    response = oRota.rotaDelete(args);
                break;
                case 'add':
                    response = oRota.rotaAdd(args);
                break;
                case 'remove':
                    response = oRota.rotaRemove(args);
                break;
                case 'list':
                    response = oRota.rotaList(args);
                break;
                case 'help':
                    response = oRota.rotaHelp(args);
                break;
                default:
                    response = oRota.rotaWhosOn(subCommand, args);
                break;
            }

            console.log('got a response of ' + response);

            return response;
        }).catch(function(err) {
            console.error(err);
        });

        return DDBRequestPromise;
    }

    /*
     * Tells the user who's on the rota
     */
    rotaWhosOn(rotaName, args) {
        if (rotaName.length == 0) {
            return 'Please specify which rota you want to lookup, e.g. `/rota brews`';
        } else if (this.rotas[rotaName] != null) {
            if (this.rotas[rotaName].users.length > 0) {
                var onRota = this.getWeekdayRota(this.rotas[rotaName].users);
                return onRota + ' is currently active on the *' + rotaName + '* rota';
            } else {
                return 'There are no people on the *' + rotaName + '* rota';
            }
        } else {
            return '*' + rotaName + '* rota could not be found';
        }
    }

    /*
     * Returns help text on how to use the bot
     */
    rotaHelp(args) {
        return 'Need some help eh buddy?!'; 
    }

    /*
     * Creates a new rota
     */
    rotaCreate(args) {
        var rotaName = this.getFirstWord(args);

        console.log('creating rota ' + rotaName);
        console.log(this.rotas);

        if (rotaName.length == 0) {
            return 'You must provide a rota name to create, e.g. `/rota create brews`';
        } else if (this.rotas[rotaName] != null) {
            return 'There is already a rota named *' + rotaName + '*';
        } else {
            this.rotas[rotaName] = {'pointer': 0, 'users' : []};
            this.saveRotas();
            return 'Created empty rota *' + rotaName + '*';
        }
    }

    /*
     * Deletes a rota
     */
    rotaDelete(args) {
        var rotaName = this.getFirstWord(args);

        if (rotaName.length == 0) {
            return 'You must provide a rota name to delete, e.g. `/rota delete brews`';
        } else if (this.rotas[rotaName] != null) {
            delete this.rotas[rotaName];
            this.saveRotas();
            return '*' + rotaName + '* has been deleted';
        } else {
            return '*' + rotaName + '* rota could not be found';
        }
    }

    /*
     * Adds a slack user to a rota
     */
    rotaAdd(args) {
        var rotaName = this.getFirstWord(args);

        if (rotaName.length == 0) {
            return 'You must specify a rota and who you want to add to it. e.g. `/rota add brews @dave`';
        } else if (this.rotas[rotaName] != null) {
            // get the user details
            var args = args.replace(rotaName, '').trim();       
            var user = this.getFirstWord(args);

            if (args.length == 0) {
                return 'You must specify a user to add to the rota, e.g. `/rota add brews @dave`';
            } else if (this.rotas[rotaName]['users'].indexOf(user) != -1) {
                return 'User *' + user + '* is already on the *' + rotaName + '* rota';
            } else {
                this.rotas[rotaName]['users'].push(user);
                this.saveRotas();
                return  'Adding *' + user + '* to *' + rotaName + '*';
            }
        } else {
            return '*' + rotaName + '* rota was not found. Create it with `/rota create ' + rotaName + '`';
        }
    }

    /*
     * Removes a slack user from a rota
     */
    rotaRemove(args) {
        var rotaName = this.getFirstWord(args);

        if (rotaName.length == 0) {
            return 'You must provide a rota name to remove people from, e.g. `/rota remove brews @dave`';
        } else if (this.rotas[rotaName] != null) {
            // get the user details
            var args = args.replace(rotaName, '').trim();
            var user = this.getFirstWord(args);
                
            if (args.length == 0) {
                return 'You must specify a user to remove from the rota, e.g. `/rota remove brews @dave`';
            } else if (this.rotas[rotaName]['users'].indexOf(user) != -1) {
                delete this.rotas[rotaName]['users'][this.rotas[rotaName]['users'].indexOf(user)];
                this.saveRotas();
                return 'Removed *' + user + '* from *' + rotaName + '*';
            } else {
                return  '*' + user + '* is not on the *' + rotaName + '* rota';
            }
        } else {
            return '*' + rotaName + '* rota could not be found';
        }
    }

    /*
     * Lists rotas, or if given a rota name, lists the slack users in the rota
     */
    rotaList(args) {
        var rotaName = this.getFirstWord(args);

        if (Object.keys(this.rotas).length == 0) {
            return 'There are no existing rotas';
        } else if (rotaName.length == 0) {
            return 'Existing rotas: ' + Object.keys(this.rotas).join(', ');
        } else if (this.rotas[rotaName] != null) {
            if (Object.keys(this.rotas[rotaName]['users']).length == 0) {
                return '*' + rotaName + '* is empty. Add members by running `/rota add ' + rotaName + ' @dave`';
            } else {
                return '*' + rotaName + '* rota has the following members: ' + this.rotas[rotaName]['users'].join(',');
            }
        } else {
            return '*' + rotaName + '* rota was not found. Create it with `/rota create ' + rotaName + '`';
        }
    }

    /*
     * Saves rotas to storage
     */
    saveRotas() {
        var params = {
            Item: {
                team_id: this.message.originalRequest.team_id,
                date: Date.now(),
                message: this.rotas
            },
            TableName: 'slack-rotabot'
        }

        docClient.put(params, function(err, data) {
            if (err) {
                console.error(err);
                return false;
            }

            return true;
        });
    }
};

module.exports = rota;
