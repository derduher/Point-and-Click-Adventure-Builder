$(function() {
// Objective Definitions
var theObjectives = [
	{objectiveTitle: 'open door', id: 'opendoor', order: 3, object: 'door', 'var': {state: 'on'}},
	{objectiveTitle: 'pick up key', id: 'pickupkey', order: 1, object: 'key', pickup: true},
	{objectiveTitle: 'unlock door', id: 'unlockdoor', order: 2, object: 'door', 'var': {unlocked: true}}
];
// Item Definitions
var items = {
	items: [{ id: 'key', active: false}],
	interactables: [{
		id: 'door',
		unlocked: false,
		active: true,
		combinable: {
			accepts: 'key',
//replace with state reflecting what the model has been combined with
			sets: {
				'unlocked': true
			}
		},
		toggles: {
			states: ['on', 'off'],
			'if': 'unlocked',
			'else': 'the door is locked',
			initial: 1
		}
	},
	{
		id: 'bed',
		open: false,
		active: true,
		events: {click: ['open']},
		produces: {
			object:'key',
			on: 'open'
		}
	}]
};

/**
 * Objective Definitions
 */

// Objective Model
var Objective = Backbone.Model.extend({
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
}),
	PickupItem = Item.extend({
}),
	InteractableItem = Item.extend({
		toggle: function () {
			var cond, toggle = this.get('toggles');
			if (!this.has('toggles')) {
				return false;
			}
			if (this.has('condition') && this.get(this.get('condition')) !== true) {
				this.trigger('failedToggleCondition', toggle['else']);
				return false;
			} else {
				this.statePos = (this.statePos + 1) % this.states.length;
				this.set({state: this.states[this.statePos]});
				return this;
			}
		},
		initialize: function () {
			if (this.has('toggles')) {
				var toggles = this.get('toggles');
				this.states = toggles.states;
				this.statePos = toggles.initial;
				this.set({state: this.states[this.statePos]});
				if (toggles['if']) {
					this.set({condition: toggles['if']});
				}
			}
		}
	}),
	Combinable = InteractableItem.extend({});
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
		_(this).bindAll('render', 'remove', 'renderSetableChange', 'renderSetable');
		this.model.bind('remove', this.remove);
		this.model.bind('change:active', this.renderSetableChange);
		this.el.id = this.model.get('id');
	},
	renderSetableChange: function (model, value){
		var changed = model.changedAttributes();
		_(changed).map(this.renderSetable, this);
	},
	renderSetable: function (stateVal, stateName) {
		if (this.model.get(stateName) === stateVal) {
			$(this.el).addClass(stateName);
		} else {
			$(this.el).removeClass(stateName);
		}
		return this;
	},
	render: function () {
		this.renderSetable(true, 'active');
		return this;
	}
});

var InventoryItemView = ItemView.extend({
	tagName: 'li',
	events: {
		dragend: 'dragend',
		dragstart: 'dragstart'
	},
	dragstart: function (e) {
		var dt = e.originalEvent.dataTransfer;
		dt.effectAllowed = 'all';
		dt.dropEffect = 'link';
		dt.setData('Text', this.id);
		return true;
	},
	dragend: function (e) {
		e.preventDefault();
		if (e.originalEvent.dataTransfer.dropEffect == 'none'){
			console.log('not it');
		} else {
			this.options.inventoryItems.remove(this.model);
		}
	},
	initialize: function () {
		ItemView.prototype.initialize.call(this);
	},
	render: function () {
		ItemView.prototype.render.call(this);
		$(this.el).attr('draggable', true);
		return this;
	}
});

var InteractableItemView = ItemView.extend({
	initialize: function () {
		ItemView.prototype.initialize.call(this);
		_(this).bindAll('toggle','produce', 'open', 'renderState', 'showFailedToggle');
		this.model.bind('change:state', this.renderState);
		this.model.bind('change:open', this.renderSetableChange);
		this.model.bind('failedToggleCondition', this.showFailedToggle);
		if (this.model.has('produces')) {
			this.model.bind('change:' + this.model.get('produces').on, this.produce);
		}
		if (this.model.has('toggles')) {
			this.events.click = 'toggle';
			this.delegateEvents(this.events);
		}
		if (this.model.has('events')) {
			_(this.model.get('events')).each(function (val, key) {
				var obj = {};
				_(val).each(function (arVal) {
					obj[key] = arVal;
					this.delegateEvents(obj);
				},this);
			}, this);
		}
	},
	render: function () {
		ItemView.prototype.render.call(this);
		if (this.model.has('state')) {
			this.renderState();
		}
		return this;
	},
	produce: function () {
		this.collection.get(this.model.get('produces').object).set({active: true});
	},
	open: function () {
		this.model.set({'open': true});
	},
	toggle: function () {
		this.model.toggle();
		return this;
	},
	renderState: function () {
		$(this.el).removeClass(this.model.previous('state'));
		$(this.el).addClass(this.model.get('state'));
		return this;
	},
	showFailedToggle: function (msg) {
		var dialogue = new DialogueView({model: new Dialogue({message: msg})});
		$('#main').append(dialogue.render().el);
		return this;
	}
});
var CombinableItemView = InteractableItemView.extend({
	events: {
		drop: 'drop',
		dragenter: 'dragEnter',
		dragleave: 'dragLeave',
		dragover: 'dragOver'
	},
	dragOver: function (e) {
		e.preventDefault();
		return false;
	},
	dragEnter: function (e) {
		e.preventDefault();
		e.originalEvent.dataTransfer.dropEffect = 'move';
		return false;
	},
	dragLeave: function (e) {
		e.preventDefault();
		return false;
	},
	initialize: function () {
		InteractableItemView.prototype.initialize.call(this);
		_(this).bindAll('drop','dragEnter', 'dragLeave');
		this.model.bind('change:' + _(this.model.get('sets')).keys()[0], this.renderSetableChange);
	},
	render: function () {
		InteractableItemView.prototype.render.call(this);
		if (this.model.has('sets')) {
			_(this.model.get('sets')).map(this.renderSetable, this);
		}
		return this;
	},
	drop: function (e, ui) {
		if (e.stopPropagation) {
			e.stopPropagation();
		}
		if (this.model.has('sets')) {
			this.model.set(this.model.get('sets'));
		}
		return this;
	}
});

var PickupItemView = ItemView.extend({
	events: {
		'click': 'pickup'
	},
	pickup: function () {
		this.collection.trigger('pickup', this.model);
		this.model.trigger('pickup', this.model);
	}
});

var StageView = Backbone.View.extend({
	id: 'stage',
	initialize: function () {
		_(this).bindAll('render','appendItem');
	},
	render: function () {
		_(this.model.get('items').models).each(function (item) {
			this.appendItem(item, PickupItemView);
		}, this);
		_(this.model.get('interactables').models).each(function (item) {
			var View = InteractableItemView;
			if (item instanceof Combinable) {
				View = CombinableItemView;
			}
			this.appendItem(item, View);
		}, this);
		return this;
	},
	appendItem: function (item, View) {
		var view = new View({el: '#' + item.id, model: item, collection: this.model.get('items')});
		$(this.el).append(view.render().el);
	}
});

var ObjectiveView = Backbone.View.extend({
	tagName: 'li',
	initialize: function () {
		_(this).bindAll('render', 'pickup', 'stateChange');
		this.model.bind('change', this.render);
		if (this.model.has('pickup')) {
			this.options.stageItems.get(this.model.get('object')).bind('pickup', this.pickup);
		}
		if (this.model.has('var')) {
			this.options.interactables.get(this.model.get('object')).bind('change:' + _(this.model.get('var')).keys()[0], this.stateChange);
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
		var changed = what.changedAttributes(),
			al = this.model.get('var'),
			key = _(al).keys()[0];
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
		_(this).bindAll('render', 'appendObjective');
		this.collection = this.options.objectives;
		this.collection.bind('add', this.appendObjective);
	},
	render: function () {
		_(this.collection.models).each(function (objective) {
			this.appendObjective(objective);
		},this);
		return this;
	},
	appendObjective: function (objective) {
		var objectiveView = new ObjectiveView({
			el: '#' + objective.id,
			model: objective,
			stageItems: this.options.stageItems,
			interactables: this.options.interactables});
		$(this.el).append(objectiveView.render().el);
		return this;
	}
});

var InventoryView = Backbone.View.extend({
	id: 'inventory',
	tagName: 'section',
	//events: {
		//drop: 'drop',
		//dragenter: 'dragEnter',
		//dragover: 'dragOver'
	//},
	dragOver: function (e) {
		console.log('dragOver');
		e.preventDefault();
	},
	dragEnter: function (e) {
		e.preventDefault();
		console.log('dragEnter');
	},
	drop: function (e) {
		console.log('dropped');
		e.preventDefault();
	},
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
		_(this).bindAll('render', 'renderItem', 'pickup');
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
		this.stageItems.remove(item);
		this.collection.add(item);
		return this;
	}
});

var DialogueView = Backbone.View.extend ({
	id: 'dialogue',
	initialize: function () {
		_(this).bindAll('render', 'remove');
		this.model.bind('remove', this.remove);
	},
	render: function () {
		$(this.el).text(this.model.get('message'));
		var tmp = function (model) {model.trigger('remove');};
		_(tmp).delay(2000, this.model);
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
var interactables = _(items.interactables).map(function (item) {
	var Obj = InteractableItem;
	if (item.combinable !== undefined) {
		Obj = Combinable;
		item = _(item).extend(item.combinable);
		item.combinable = undefined;
	}
	return new Obj(item);
});
window.stage = new Stage({
	items: new PickupItems(items.items),
	interactables: new InteractableItems(interactables)
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
