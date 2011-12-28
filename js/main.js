$(function() {
// Objective Definitions
var theObjectives = [
	{objectiveTitle: 'open door', id: 'opendoor', order: 3, object: 'door', 'var': {state: 'on'}},
	{objectiveTitle: 'pick up key', id: 'pickupkey', order: 1, object: 'key', pickup: true},
	{objectiveTitle: 'unlock door', id: 'unlockdoor', order: 2, object: 'door', 'var': {unlocked: true}}
];
// Item Definitions
var items = {
	items: [{ id: 'key', 'type': 'inventory'}],
	interactables: [{
		id: 'door',
		'type': 'interactable',
		unlocked: false,
		'combineable': {
			accepts: 'key',
//replace with state reflecting what the model has been combined with
			sets: {
				'unlocked': true
			}
		},
		toggles: {
			on: {
				nextstate: 'off'
			},
			off: {
				nextstate: 'on'
			},
			'if': 'unlocked',
			'else': 'the door is locked',
			initial: 'off'
		}
	}]
};

/**
 * Objective Definitions
 */

// Objective Model
var Objective = Backbone.Model.extend({
	defaults: {
		// The short text of the objective
		objectiveTitle: false,
		// The unique identifier for the objective
		id: false
	},
		//TODO: figure out how to make this private
	isComplete : false,
	markComplete: function () {
		this.set({'isComplete': true});
		return this;
	},
	complete: function (state) {
		if (state !== undefined && state !== null) {
			this.model.set({'isComplete': state});
			return this;
		}
		return this.get('isComplete');
	}
});

var ObjectiveList = Backbone.Collection.extend({
	model: Objective,
	comparator: function (objective) {
		return objective.get('order');
	}
});

var Item = Backbone.Model.extend({
	defaults: {}
});

var PickupItem = Item.extend({
	defaults: {type: 'pickup'}
});
var InteractableItem = Item.extend({
	defaults: {
		combineable: false,
		toggles: false
	},
	type: 'interactable',
	toggle: function () {
		var toggle, cond;
		if ((toggle = this.get('toggles')) === false) {
			return false;
		}
		if (toggle['if'] === undefined || toggle['if'] !== undefined && this.get(toggle['if']) === true) {
			//do toggle
			this.set({previousState: this.get('state')});
			this.set({state : toggle[this.get('state')].nextstate});
			return this;
		} else {
			this.trigger('failedToggleCondition', toggle['else']);
			return false;
		}
	},
	initialize: function () {
		if (this.get('toggles') !== false) {
			this.set({state : this.get('toggles').initial});
		}
	}
});
var Items = Backbone.Collection.extend({
	model: Item
});
var PickupItems = Items.extend({
	model: PickupItem
});
var InteractableItems = Items.extend({
	model: InteractableItem
});

var Stage = Backbone.Model.extend({
	defaults: {
		items: false,
		interactables: false
	}
});

var Inventory = Backbone.Model.extend({
	defaults: {
		items: false
	},
	initialize: function () {
		if (!this.get('items')) {
			this.set({'items': new Items()});
		}
	}
});

var Dialogue = Backbone.Model.extend({});

/**
 * View Definitions
 *
 */

// This should have functions which are relevant to both InventoryItems and interactables
// is a inventory item rendered any different from a interactable?
var ItemView = Backbone.View.extend({
	className: 'item',
	initialize: function () {
		_.bindAll(this, 'render', 'remove');
		//this.model.bind('change', this.render);
		this.model.bind('remove', this.remove);
		this.el.id = this.model.get('id');
	}
});

var InventoryItemView = ItemView.extend({
	tagName: 'li',
	events: {
		'combined': 'combined'
	},
	initialize: function () {
		//call parent init
		ItemView.prototype.initialize.call(this);

		//this.model.bind('remove', this.remove);
		$(this.el).draggable({
			containment: 'body',
			zIndex: 200,
			revert: 'invalid'
		});
	},
	combined: function () {
		this.options.inventoryItems.remove(this.model);
	}
});

var InteractableItemView = ItemView.extend({
	events: {
		'click': 'toggle'
	},
	initialize: function () {
		ItemView.prototype.initialize.call(this);
		_.bindAll(this, 'render', 'toggle', 'drop', 'renderState', 'renderSetable', 'renderSetableChange', 'showFailedToggle');
		//this.model.bind('change', this.render);
		// would need to be modified to handle multiple sets.
		this.model.bind('change:state', this.renderState);
		this.model.bind('failedToggleCondition', this.showFailedToggle);
		if (this.model.has('combineable')) {
			this.model.bind('change:' + _.keys(this.model.get('combineable').sets)[0], this.renderSetableChange);
			$(this.el).droppable({
				drop: this.drop,
				hoverClass: 'drophover'
			});
			if (this.model.get('combineable').accepts !== undefined) {
				$(this.el).droppable('option', 'accept', '#' + this.model.get('combineable').accepts);
			}
		}
	},
	render: function () {
		ItemView.prototype.render.call(this);
		if (this.model.has('state')) {
			this.renderState();
		}
		if (this.model.has('combineable') && this.model.get('combineable').sets !== undefined) {
			_.map(this.model.get('combineable').sets, this.renderSetable, this);
		}
		return this;
	},
	toggle: function () {
		//when this fails should we call dialogue directly here?
		//does dialogue have a model?
		this.model.toggle();
		return this;
	},
	drop: function (event, ui) {
		if (this.model.get('combineable').sets !== undefined) {
			this.model.set(this.model.get('combineable').sets);
		}
		$(ui.draggable).trigger('combined');
		return this;
	},
	renderSetableChange: function (model, value){
		var changed = model.changedAttributes();
		_.map(changed, this.renderSetable, this);
	},
	renderSetable: function (stateVal, stateName) {
		if (this.model.get(stateName) === stateVal) {
			$(this.el).addClass(stateName);
		} else {
			$(this.el).removeClass(stateName);
		}
		return this;
	},
	renderState: function () {
		if (this.model.has('previousState')) {
			$(this.el).removeClass(this.model.get('previousState'));
		}
		$(this.el).addClass(this.model.get('state'));
		return this;
	},
	showFailedToggle: function (msg) {
		var dialogue = new DialogueView({model: new Dialogue({message: msg})});
		$('#main').append(dialogue.render().el);
		return this;
	}
});

var PickupItemView = ItemView.extend({
	//bind to click here
	events: {
		'click': 'pickup'
	},
	pickup: function () {
		// notify the model?
		this.collection.trigger('pickup', this.model);
		this.model.trigger('pickup', this.model);
	}
});

var StageView = Backbone.View.extend({
	id: 'stage',
	initialize: function () {
		_.bindAll(this, 'render','appendItem');
	},
	render: function () {
		_.each(this.model.get('items').models, function (item) {
			this.appendItem(item, 'pickup');
		}, this);
		_.each(this.model.get('interactables').models, function (item) {
			this.appendItem(item, 'interactable');
		}, this);
		return this;
	},
	appendItem: function (item, type) {
		var view;
		if (type === 'pickup') {
			view = new PickupItemView ({el: '#' + item.id, model: item, collection: this.model.get('items')});
		} else {
			view = new InteractableItemView ({el: '#' + item.id, model: item});
		}

		$(this.el).append(view.render().el);
	}
});

var ObjectiveView = Backbone.View.extend({
	tagName: 'li',
	initialize: function () {
		_.bindAll(this, 'render', 'pickup', 'stateChange');
		this.model.bind('change', this.render);
		if (this.model.has('pickup')) {
			this.options.stageItems.get(this.model.get('object')).bind('pickup', this.pickup);
		}
		if (this.model.has('var')) {
			this.options.interactables.get(this.model.get('object')).bind('change:' + _.keys(this.model.get('var'))[0], this.stateChange);
		}
	},
	render: function () {
		if (this.model.get('isComplete')) {
			$(this.el).addClass('met');
		}
		$(this.el).text(this.model.get('objectiveTitle'));
		return this;
	},
	pickup: function (item) {
		this.model.set({'isComplete': true});
	},
	stateChange: function (what) {
		var changed = what.changedAttributes();
		var al = this.model.get('var');
		var key = _.keys(al)[0];
		if (al[key] === changed[key]) {
			this.model.set({isComplete: true});
			what.unbind('change:' + key, this.stateChange);
		}
	}
});

var ObjectivesListView = Backbone.View.extend({
	id: 'objectives',
	tagName: 'ol',
	initialize: function () {
		_.bindAll(this, 'render', 'appendObjective');
		this.collection = this.options.objectives;
		this.collection.bind('add', this.appendObjective);
	},
	render: function () {
		_.each(this.collection.models, function (objective) {
			this.appendObjective(objective);
		},this);
		return this;
	},
	appendObjective: function (objective) {
		var objectiveView = new ObjectiveView({el: '#' + objective.id, model: objective, stageItems: this.options.stageItems, interactables: this.options.interactables});
		$(this.el).append(objectiveView.render().el);
		return this;
	}
});

var InventoryView = Backbone.View.extend({
	id: 'inventory',
	tagName: 'section',
	render: function () {
		var view = new InventoryItemsView({collection: this.model.get('items'), stage: this.options.stage});
		$(this.el).append(view.render().el);
		return this;
	}
});

var InventoryItemsView = Backbone.View.extend({
	tagName: 'ul',
	id: 'inventoryItems',
	initialize: function () {
		_.bindAll(this, 'render', 'renderItem', 'pickup');
		this.collection.bind('add', this.renderItem);
		this.stageItems = this.options.stage.get('items');
		this.stageItems.bind('pickup', this.pickup);
	},
	render: function () {
		this.collection.each(this.renderItem);
		return this;
	},
	renderItem: function (item) {
		var view = new InventoryItemView({
			model: item,
			inventoryItems: this.collection
		});
		$(this.el).append(view.render().el);
		return this;
	},
	pickup: function (item) {
		//Turn item into an inventoryItem
		this.stageItems.remove(item);
		this.collection.add(item);
		return this;
	}
});

var DialogueView = Backbone.View.extend ({
	id: 'dialogue',
	initialize: function () {
		_.bindAll(this, 'render', 'remove');
		this.model.bind('remove', this.remove);
	},
	render: function () {
		$(this.el).text(this.model.get('message'));
		var tmp = function (model) {model.trigger('remove');};
		_.delay(tmp, 2000, this.model);
		return this;
	},
	remove: function () {
		$(this.el).fadeOut(400, function (e) {
			$(this).remove();
		});
	}
});

/**
 * Model kickstart.
 */
window.stage = new Stage({
	items: new PickupItems(items.items),
	interactables: new InteractableItems(items.interactables)
});
var inventory = new Inventory();
var theobjectives = new ObjectiveList(theObjectives);

/**
 * Router Definition
 */
var PointAndClickGame = Backbone.Router.extend({
	routes: {
		'': 'home',
		'blank': 'blank'
	},

	initialize: function () {
		this.objectivesView = new ObjectivesListView({
			el: '#objectives',
			objectives: theobjectives,
			interactables: stage.get('interactables'),
			stageItems: stage.get('items')
		});

		this.inventoryView = new InventoryView({
			model: inventory,
			stage: stage,
			el: '#inventory'
		});

		this.stageView = new StageView({
			model: stage,
			el: '#stage'
		});
		
	},

	home: function() {
		$('#main').append(this.inventoryView.render().el)
			.append(this.stageView.render().el)
			.append(this.objectivesView.render().el);
	},

	blank: function() {
		$('#container').empty();
		$('#container').text('blank');
	}
});


	window.App = new PointAndClickGame();
	Backbone.history.start();

});
