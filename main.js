$(function() {
    var theObjectives = {
        'dooropened': 'opendoor',
        'keypickedup': 'pickupkey',
        'doorunlocked': 'unlockdoor'
    };
    var items = {
        'key': {
            'type': 'inventory',
            'pickup': 'keypickedup'
        },
        'door': {
            'type': 'interactable',
            'combineable': {
                accepts: 'key',
                triggers: 'doorunlocked',
                sets: {
                    key: 'unlocked',
                    value: true
                },
                changes: {
                    'border': '2px solid white'
                }
            },
            toggles: {
                on: {
                    changes: {
                        'background-color': 'lightgray'
                    },
                    triggers: 'dooropened',
                    nextstate: 'off'
                },
                off: {
                    changes: {
                        'background-color': 'black'
                    },
                    triggers: 'doorclosed',
                    nextstate: 'on'
                },
                'if': 'unlocked',
                'else': 'the door is locked',
                initial: 'off'
            }
        }
    };

    //
    var objectivesDOM = $('#objectives li');
    // util function?
    var applyChanges = function(changes) {
        for (var prop in changes) {
            $(this).css(prop, changes[prop]);
        }
    };
    var game = (function(dialogueid) {
        dialogueSelector = '#' + dialogueid
        var removeDialogue = function() {
            $(dialogueSelector).fadeOut(400, function(e) {
                $(this).remove();
            });

        };
        var dialogue = function(message, timeout) {
            timeout = timeout || 2;
            $('<div />').text(message).appendTo('body').attr('id', dialogueid);
            window.setTimeout(removeDialogue, timeout * 1000);
        };
        return {
            dialogue: dialogue
        };
    })('dialogue');

    // Something for operating on our objectives
    var inventory = (function(inventorySelector) {
        var addToInventory = function(item) {
            //this is the inventory object
            $(item).appendTo(inventorySelector);
            $(item).draggable({
                containment: 'body',
                zIndex: 200,
                revert: 'invalid'
            });
        };
        return {
            add: addToInventory
        };
    })('#inventory');


    // creates items (optional) and returns a stage object
    var stage = (function() {
        var createItem = function(item, id) {
            if (item.type === 'inventory') {
                $('#' + id).on('click', function(e) {
                    inventory.add(this);
                    if (item.pickup) {
                        objectivesDOM.trigger(item.pickup);
                    }
                });
            } else if (item.type === 'interactable') {
                if (item.toggles) {
                    var initial = item.toggles[item.toggles.initial];
                    applyChanges.call($('#' + id).data('nextstate', initial.nextstate).get(0), initial.changes);
                }
                $('#' + id).on('click', function(e) {
                    if (item.toggles) {
                        var newstatename = $(this).data('nextstate'),
                            newstate = item.toggles[newstatename],
                            condition = item.toggles['if'];

                        if (condition === null || condition !== null && $(this).data(condition)) {
                            applyChanges.call(this, newstate.changes);
                            if (newstate.triggers) {
                                objectivesDOM.trigger(newstate.triggers);
                            }
                            $(this).data('nextstate', newstate.nextstate);
                        } else {
                            game.dialogue(item.toggles['else']);
                        }
                    }
                    //set up a one time handler here
                });
            } else {
                alert('type not handled: ' + item.type);
            }

            if (item.combineable) {
                if (item.combineable.accepts) {
                    $("#" + id).droppable({
                        drop: function(event, ui) {
                            $(this).data(item.combineable.sets.key, item.combineable.sets.value);
                            applyChanges.call(this, item.combineable.changes);
                            objectivesDOM.trigger(item.combineable.triggers);
                            $(ui.draggable).remove();
                        },
                        hoverClass: 'drophover'
                    });
                }
                //todo: Else it accepts everything?
            }
        };
        return function(items) {

            if (items) {
                for (var id in items) {
                    var item = items[id];
                    createItem(item, id);
                }
            }
            return {
                createItem: createItem
            };
        };
    })();

    //Lets make this return something for operating on the objectives.
    var objectives = function(objectives) {
        var conditionMet = function(e) {
            var obj = e.target;
            if (!$(obj).data('met')) {
                $(obj).addClass('met');
                $(obj).data('met', true);
            }
        };
        for (var evt in objectives) {
            $('#' + objectives[evt]).on(evt, conditionMet);
        }
    };
    
    var init = function() {
        var aStage = stage(items);
        objectives(theObjectives);
    };
    
    init();

});