/* jshint jquery:true, camelcase: false */
/* global Salt, Router */
// Your starting point. Enjoy the ride!
(function (window) {
	'use strict';

	var todoSalt, todoItemProgram, keyCodes;

	// map of key codes
	keyCodes = {
		ESCAPE: 27,
		RETURN: 13,
		SPACE: 32,
		TAB: 9
	};

	todoSalt = new Salt({

		// branch properties
		_data: [
			'gui',
			'todoTpl',
			'router'
		],

		// action when entering this state
		// the string is short-hand for `this.get('@start')`
		_in: '>@start',

		//setup/
		setup: {

			// action when bypassing this state (toward older sibling)
			// the string is short-hand for `this.go('@self')`
			_over: '@self',

			// walk branch after this state is targeted
			_sequence: true,

			//setup/gui/
			gui: {

				//setup/gui/dom/
				// the function implements `_on: function () {...}`
				dom: function () {

					var $filters = $('#filters');

					// init collection of dom references
					this.data.gui = {
						$app: $('#todoapp'),
						$todos: $('#todo-list'),
						$draftTodo: $('#new-todo'),
						$main: $('#main'),
						$markAll: $('#toggle-all'),
						$count: $('#todo-count'),
						$footer: $('#footer'),
						$clear: $('#clear-completed'),
						$filters: $filters,
						$tab_all: $filters.find('li:eq(0) > a'),	// "All" link
						$tab_active: $filters.find('li:eq(1) > a'),	// "Active" link
						$tab_completed: $filters.find('li:eq(2) > a')		// "Completed" link
					};

				},

				//setup/gui/binds/
				bind: {

					//setup/gui/bind/dom/
					// the function implements `_on: function () {...}`
					dom: function () {
						var salt, $app;

						salt = this;
						$app = salt.data.gui.$app;

						// bind events with program states and queries
						$app.on('keyup', '#new-todo', salt.callbacks('/draft/input'));
						$app.on('change', '#toggle-all', salt.callbacks('../../mark'));
						$app.on('click', '#clear-completed', salt.callbacks('/purge'));
					},

					//setup/gui/bind/window/
					// the function implements `_on: function () {...}`
					window: function () {
						// exit program when the page unloads
						$(window).on('unload', this.callbacks('..//'));
					}

				}

			},

			//setup/routing/
			// the function implements `_on: function () {...}`
			routing: function () {
				var salt = this;

				// bind routes to program paths via `.callbacks()`
				salt.vars.router = new Router({
					'/': salt.callbacks('//list/all'),
					'/all': salt.callbacks('//list/all'),
					'/active': salt.callbacks('//list/active'),
					'/completed': salt.callbacks('//list/completed')
				});

			},

			//setup/template/
			// the function implements `_on: function () {...}`
			template: function () {
				var data = this.data;

				// expose the existing LI as an item template
				data.itemTpl = data.gui.$todos.find('li:last').clone();
			},

			//setup/stage/
			// the function implements `_on: function () {...}`
			stage: function () {
				var gui = this.data.gui;

				// empty ul
				gui.$todos.empty();

				// unselect available filters
				gui.$filters.find('a').removeClass('selected');
			}

		},

		//teardown/
		teardown: {

			// action when bypassing this state (towards younger sibling or parent)
			// the string is short-hand for `this.go('@self')`
			_bover: '@self',

			// walk branch after this state is targeted
			_sequence: true,

			//teardown/routing/
			// the function implements `_on: function () {...}`
			routing: function () {
				this.vars.router.destroy();
			},

			//teardown/gui/
			gui: {

				//teardown/gui/bind/
				bind: {

					//teardown/gui/bind/dom/
					// the function implements `_on: function () {...}`
					dom: function () {
						this.data.gui.$app.off();
					},

					//teardown/gui/bind/window/
					// the function implements `_on: function () {...}`
					window: function () {
						// exit program when the page unloads
						$(window).off('unload', this.callbacks('..//'));
					}
				}

			}

		},

		//list/
		list: {

			// custom token for targeting this branch
			_alias: 'start',

			// make this state a branch root
			_root: true,

			// action when entering this state
			_in: function () {
				var salt = this;

				// watch location now and enable and re-routing with current hash
				salt.vars.router.init();
			},

			// load stored items first
			_next: 'load',

			// action when this state is targeted
			// the string is short-hand for `this.go('all')`
			_on: 'all',

			// identify criteria to capture or filter instances
			// this selects all instances
			_capture: true,

			//list/load/
			load: {

				// set access-control for this branch
				// the value denies all external directions
				_perms: false,

				// branch properties
				_data: 'items',

				// action when entering this state
				_in: function () {
					var salt = this;

					// init branch property as stored or new array
					salt.data.items = JSON.parse(localStorage.getItem('todo-salt')) || [];
				},

				// action when this state is targeted
				_on: function () {
					var items, itemData, itemSalt, i, itemLength;

					items = this.data.items;
					itemLength = items.length;

					if (items.length) {
						// create, start and load instances with stored values
						for (i = 0; i < itemLength; i++) {
							itemData = items[i];
							itemSalt = new Salt(todoItemProgram);
							itemSalt.get('@program', itemData.title, itemData.completed);
						}
					}
				}

			},

			//list/save/
			// the function implements `_on: function () {...}`
			save: function () {
				var salt = this;

				// serialize and store text and completion state of each "child" Salt instance
				localStorage.setItem(
					'todo-salt',
					JSON.stringify(
						salt.subs().map(function (itemSalt) {
							return {
								title: itemSalt.data.text,
								completed: itemSalt.state.name === 'complete'
							};
						})
					)
				);
			},

			//list/all/
			all: {

				// defines this as the local-root of this branch
				_root: true,

				// action when entering this state
				_in: function () {
					var salt = this;

					// set selected class for same-named tab
					salt.data.gui['$tab_' + salt.state.name].addClass('selected');

					// set location hash
					salt.vars.router.setRoute(salt.state.name);
				},

				// action when this state is targeted
				// the string is short-hand for `this.go('update')`
				_on: 'update',

				// action when exiting this state
				_out: function () {
					// unhighlight the corresponding tab
					this.data.gui['$tab_' + this.state.name].removeClass('selected');
				},

				//list/all/update
				update: {

					// walk branch after arriving on this state
					_sequence: true,

					// branch properties
					_data: [
						'totalInsts',
						'total',
						'doneInsts',
						'done',
						'destroyed',
						'destroyedInsts'
					],

					// action when entering this state
					_in: function () {
						var salt, data, subs;

						salt = this;
						data = salt.data;
						subs = salt.subs();

						// determine total sub-instances (ignore items in destruction)
						data.totalInsts = subs.filter(function (itemSalt) {
							return itemSalt.state.index > 1;
						});
						data.total = data.totalInsts.length;

						// determine completed items
						data.doneInsts = subs.filter(function (itemSalt) {
							return itemSalt.state.name === 'complete';
						});
						data.done = data.doneInsts.length;

						// determine completed items
						data.destroyedInsts = subs.filter(function (itemSalt) {
							return itemSalt.state.index < 2;
						});
						data.destroyed = data.destroyedInsts.length;
					},

					//list/all/update/stage
					// the function implements `_on: function () {...}`
					stage: function () {
						var salt, data, gui, instsToRemove;

						salt = this;
						data = salt.data;
						gui = data.gui;
						instsToRemove = data.destroyedInsts.concat();

						// remove main listing and children
						gui.$todos.detach();
						gui.$todos.children().detach();

						// remove items from sub-instance collection
						if (instsToRemove.length) {
							// prepend "remove" command
							instsToRemove.unshift('remove');
							// remove matching instances
							this.subs.apply(this, instsToRemove);
						}

						// re-append items matching the current filter
						gui.$todos.append.apply(
							gui.$todos,
							salt.subs(null).map(function (itemSalt) {
								return itemSalt.data.gui.$main;
							})
						);

						// re-append main container
						gui.$main.append(gui.$todos);

					},

					//list/all/update/footer
					// the function implements `_on: function () {...}`
					footer: function () {
						var salt, $footer;

						salt = this;
						$footer = salt.data.gui.$footer;

						// toggle visibility when items are present
						if (salt.data.total) {
							$footer.show();
						} else {
							$footer.hide();
						}
					},

					//list/all/update/count
					count: {

						//list/all/update/count/remaining
						// the function implements `_on: function () {...}`
						remaining: function () {
							var salt, data, gui, tally;

							salt = this;
							data = salt.data;
							gui = data.gui;
							tally = data.total - data.done;

							gui.$count.html([
									'<strong>' + tally + '</strong>',
									' item',
									tally === 1 ? '' : 's',
									' left'
								].join('')
							);
						},

						//list/all/update/count/completed
						// the function implements `_on: function () {...}`
						completed: function () {
							var data, $clearButton;

							data = this.data;
							$clearButton = data.gui.$clear;

							if (data.done) {
								// show number of completed items
								$clearButton.text('Clear completed (' + data.done + ')').show();
							} else {
								// hide clear button
								$clearButton.hide();
							}
						}

					},


					//list/all/update/markAll
					// the function implements `_on: function () {...}`
					markAll: function () {
						var salt, data, gui;

						salt = this;
						data = salt.data;
						gui = salt.data.gui;

						// set markAll toggle state
						// gui.$markAll[0].checked = .prop('checked', !!(data.total && data.total === data.done));
						gui.$markAll[0].checked = data.total && data.total === data.done;
					},

					//list/all/update/save
					// the string implements `_import: '//list/save/'`
					save: '//list/save/',

				},

				//list/all/mark/
				mark: {

					// state to target if navigation ends on this branch
					_tail: '/update',

					// action when this state is targeted
					_on: function (evt) {
						var salt, subs;

						salt = this;
						subs = salt.subs();

						evt.preventDefault();

						if (subs.length) {

							if (
								subs.some(function (itemSalt) {
									return itemSalt.state.path.indexOf('complete') === -1;
								})
							) {
								// complete all when one is incomplete
								salt.go('all');
							} else if (
								subs.some(function (itemSalt) {
									return itemSalt.state.path.indexOf('complete') !== -1;
								})
							) {
								// de-complete all when one is complete
								salt.go('none');
							}

						}
					},

					//list/all/mark/all/
					// the function implements `_on: function () {...}`
					all: function () {
						this.subs().forEach(function (itemSalt) {
							itemSalt.get('//item/complete');
						});
					},

					//list/all/mark/none/
					// the function implements `_on: function () {...}`
					none: function () {
						this.subs().forEach(function (itemSalt) {
							itemSalt.get('//item');
						});
					}

				},

				//list/all/draft
				draft: {

					// action when this state is targeted
					_on: function () {
						this.data.gui.$draftTodo.focus();
					},

					//list/all/draft/input
					input: {

						// action when this state is targeted
						_on: function (evt) {
							// watch for return key
							if (evt && evt.keyCode === keyCodes.RETURN) {
								evt.preventDefault();
								this.get('enter');
							}
						},

						//list/all/draft/input/enter
						enter: {

							// branch properties
							_data: 'text',

							// action when entering this state
							_in: function () {
								var
									// alias collection of dom elements
									gui = this.data.gui,
									// get original field value
									original = gui.$draftTodo.val(),
									// the trimmed draft field value
									trimmed = $.trim(original)
								;
								// if the trimmed value is valid...
								if (trimmed.length) {
									// capture the trimmed value
									this.data.text = trimmed;
									// clear the value
									gui.$draftTodo.val('');
								} else { // otherwise, when the trimmed value is invalid...
									// if there was an untrimmed value...
									if (original) {
										// clear the draft todo field
										gui.$draftTodo.val('');
									}
									// exit to type state
									this.get('../../');
								}
							},

							// action when this state is targeted
							_on: function () {
								var salt = this;
								// add a new todo item with the entered text
								salt.get('/add', salt.data.text);
							}

						}

					}

				},

				//list/all/add
				add: {

					// set access-control for this branch
					// the string prevents sub-instances from controlling this program
					_perms: '!sub',

					// action when this state is targeted
					_on: function (text, done) {
						var salt, gui, itemSalt;

						salt = this;
						gui = salt.data.gui;
						itemSalt = new Salt(todoItemProgram);

						// pass values to the item instance
						itemSalt.get('@program', text, done);

						// if this state came from a keypress event...
						if (salt.status('trail')[0].indexOf('input') !== -1) {
							// assume, this add call came from the draft state, so go back now that we're done
							this.go('/draft');
						}
						// update the listing
						this.go('/');
					}

				},

				//list/all/purge
				// the function implements `_on: function () {...}`
				purge: function () {
					var salt, gui, completedItems, i;

					salt = this;
					gui = salt.data.gui;

					// direct completed items to their "null" state
					completedItems = salt.subs('complete');

					if (completedItems.length) {
						// lift the items container node first
						gui.$todos.detach();

						for (i = 0; completedItems[i]; i++) {
							// each item instructs this instance toward it's "/update" state
							completedItems[i].get('@null');
						}
					}
				}

			},

			//list/active/
			active: {

				// identify criteria to capture or filter instances
				// criteria requires instances be on or within their "item" branch
				_capture: 'item',

				// use this state as the base for this branch
				_import: '//list/all/'

			},

			//list/completed/
			completed: {

				// identify criteria to capture or filter instances
				// criteria requires instances be on or within their "complete" branch
				_capture: 'complete',

				// use this state as the base for this branch
				_import: '//list/all/'

			}

		}

	});
 
	// define todoItem program
	todoItemProgram = {

		// branch properties
		_data: [
			'gui',
			'text'
		],

		// action when entering this state
		_in: function () {
			// do all the setup in the program's root state
			var salt, data, gui, $main;

			salt = this;
			data = salt.data;
			// capture gui
			gui = data.gui = {};
			// get item template from owner property
			$main = salt.owner().data.itemTpl.clone();

			gui.$main = $main;
			// reference various elements within template
			gui.$view = $main.find('.view');
			gui.$label = $main.find('label');
			gui.$field = $main.find('.edit');
			gui.$mark = $main.find('.toggle');
			gui.$remove = $main.find('.destroy');

			// set relative callbacks, which are based on the current state
			$main.on('change', '.toggle', salt.callbacks('complete|incomplete'));

			// set rooted callbacks, which are based on the local root
			$main.on('blur', '.edit', salt.callbacks('/'));
			$main.on('dblclick', '.view > label', salt.callbacks('/edit'));
			$main.on('keyup', '.edit', salt.callbacks('/edit/input'));

			// set absolute callbacks, which work everytime
			$main.on('click', '.destroy', salt.callbacks('//item/destroy'));
		},

		// action when this state is targeted
		_on: function (text, done) {
			var salt = this;

			// capture given text
			salt.data.text = text;

			// rest at complete or incomplete states
			salt.go(done ? '/item/complete' : '/item/');

			// update item text
			salt.go('//item/update');
		},

		// allows an owner (e.g., "parent") relationship at initialization
		// the owner is directed to this path before entering, when stopping, or after exiting this branch
		_owner: '/',

		//item/
		item: {

			// make this state a branch root
			_root: true,

			//item/complete/
			complete: {

				// make this state a branch root
				_root: true,

				// action when entering this state
				_in: function () {
					var gui = this.data.gui;

					// check the corresponding check-box
					// for some reason `.attr('checked', 'checked')` wasn't working
					gui.$mark.prop('checked', true);

					// set class to show the task is completed
					gui.$main.addClass('completed');
				},

				//item/complete/incomplete
				incomplete: {

					// action when this state is targeted
					// the string is short-hand for `this.go('/@parent')`
					_on: '/@parent'

				},

				//item/complete/edit/
				// the string implements `_import: '//item/edit/'`
				edit: '//item/edit/',

				//item/complete/update/
				// the string implements `_import: '//item/update/'`
				update: '//item/update/',

				// action when exiting this state
				_out: function () {
					var gui = this.data.gui;

					// remove checkbox state
					// for some reason `.removeAttr('checked');` wasn't working
					gui.$mark.prop('checked', false);

					// set class to show this task is incomplete
					gui.$main.removeClass('completed');
				}

			},

			//item/edit/
			edit: {

				// allows an owner (e.g., "parent") relationship at initialization
				// the owner is not updated while in this branch
				_owner: -1,

				// action when entering this state
				_in: function () {
					var data, gui;

					data = this.data;
					gui = data.gui;

					// set value of field to the todo item value
					gui.$field.val(data.text);

					// update appearance for editing
					gui.$main.addClass('editing');
				},

				// action when this state is targeted
				_on: function () {
					// select the text field
					this.data.gui.$field.select();
				},

				//item/edit/input/
				// the function implements `_on: function () {...}`
				input: function (evt) {
					var key, isEscape;

					key = evt.keyCode;
					isEscape = key === keyCodes.ESCAPE;

					// intercept when pressing the return or escape key
					if (key === keyCodes.RETURN || isEscape) {

						// ignore these keys
						evt.preventDefault();

						// blur field
						// this triggers navigating to the /edit branch
						evt.target.blur();

						// revert field when appropriate
						if (isEscape) {
							// this must occur _after_ blurring the field, since `.go()` prepends waypoints
							this.go('/edit/revert');
						}

					}
				},

				//item/edit/revert/
				// the function implements `_on: function () {...}`
				revert: function () {
					var data = this.data;

					// reset field value
					data.gui.$field.val(data.text);
				},

				// action when exiting this state
				_out: function () {
					var salt, data, gui, enteredValue, originalValue;

					salt = this;
					data = salt.data;
					gui = data.gui;
					enteredValue = $.trim(gui.$field.val());
					originalValue = data.text;

					// consider changed values
					if (enteredValue !== originalValue) {
						if (enteredValue.length) {
							// capture new value
							data.text = enteredValue;
							// save the note
							salt.go('/update');
						} else {
							// destroy self
							salt.get('//item/destroy');
						}
					}

					// remove appearance of editing
					gui.$main.removeClass('editing');
				}

			},

			//item/update/
			// the function implements `_on: function () {...}`
			update: function () {
				var salt, gui, text;

				salt = this;
				gui = salt.data.gui;
				text = salt.data.text;

				// set text of item row - preserve whitespace
				gui.$label.html(text.replace(/\s/g, '&nbsp;'));
				// set value of item field (since it may have been trimmed)
				gui.$field.val(text);
			},

			//item/destroy
			destroy: {

				// action when this state is targeted
				// the string is short-hand for `this.get('..//')`
				_on: '>..//'

			}

		},

		// action when exiting this state
		_out: function () {
			this.data.gui.$main.off();
		}

	};

	window.todoSalt = todoSalt;

	// start this program, by targeting it's first state - the program root
	todoSalt.go('@program');

})(window);