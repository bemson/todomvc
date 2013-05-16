/*global $, Flow, crossroads */
/*

[MIT licensed](http://en.wikipedia.org/wiki/MIT_License)
(c) Bemi Faison (http://github.com/bemson/todomvc/)

*/
(function ( window ) {
	'use strict';

  // This object tree is the _program_ that will be compiled into our Todo application. declares all the states of our Todo program. When passed to Flow it is compiled into a Flow application (a Flow instance).
  //
  // Keys prefixed with an underscore, like `_data` are attributes of state
  var
    TodoProgram = {

      // Keys with an underscore are attributes of the state, also called _tags_.
      // Declare variables for this program branch. When Flow exits this branch, these variables will be destroyed.
      // Strings simply undefined variables. While objects define variables with a given value.
      //
      // This  a variables named "constants"
      _data: [
        'gui',
        'todoTpl',
        'router',
        // these could easily be function variables, but placing them here makes the program more portable
        {
          constants: {
            ESCAPE_KEY: 27,
            RETURN_KEY: 13,
            SPACE_KEY: 32,
            TAB_KEY: 9
          }
        }
      ],

      _in: function () {
        this.target( 'todos' );
      },

      setup: {

        _sequence: 1,

        _over:function () {
          this.go('@self');
        },

        gui: {

          dom: function () {
            var gui = {};

            this.data.gui = gui;

            gui.$app = $( '#todoapp' );
            gui.$todos = $( '#todo-list' );
            gui.$draftTodo = $( '#new-todo' );
            gui.$main = $( '#main' );
            gui.$markAll = $( '#toggle-all' );
            gui.$count = $( '#todo-count' );
            gui.$footer = $( '#footer' );
            gui.$clear = $( '#clear-completed' );
            gui.$filters = $( '#filters' );
            gui.$tab_all = gui.$filters.find( 'li:eq(0) > a' );
            gui.$tab_active = gui.$filters.find( 'li:eq(1) > a' );
            gui.$tab_completed = gui.$filters.find( 'li:eq(2) > a' );
          },

          events: function () {
            var
              gui = this.data.gui;

            gui.$app.on( 'keyup', '#new-todo', this.callbacks( '/draft/type' ) );
            gui.$app.on( 'change', '#toggle-all', this.callbacks( '/markAll' ) );
            gui.$app.on( 'click', '#clear-completed', this.callbacks( '/purge' ) );
            // allow links to behave like buttons (respond to space bar keys)
            gui.$app.on( 'keyup', '#filters a', this.callbacks('/monitor/filterSelect') );

            // exit the program when the page unloads
            $(window).on( 'unload', this.callbacks(0) );
          }

        },

        routing: function () {
          var
            router = crossroads.create();

          this.data.router = router;

          router.addRoute( 'active', this.callbacks('//todos/active/') );
          router.addRoute( 'completed', this.callbacks('//todos/completed') );
          router.bypassed.add(this.callbacks('//todos/all'));

          if ( 'onhashchange' in window) {
            $(window).on( 'hashchange', this.callbacks( '/monitor/hash' ) );
          }
        },

        template: function () {
          this.data.todoTpl = this.data.gui.$todos.find( 'li:last' ).clone();
        },

        stage: function () {
          var gui = this.data.gui;

          gui.$todos.empty();
          gui.$filters.find( 'a' ).removeClass( 'selected' );
        }

      },

      teardown: {

        _sequence: 1,

        // execute child states when navigating backwards
        _bover: '@self',

        // tear down router stuff
        routing: function () {
          var router = this.data.router;

          // destroy route handlers
          router.removeAllRoutes();
          router.bypassed.removeAll();

          // stop listening to hash changes
          if ( 'onhashchange' in window) {
            window.removeEventListener( 'hashchange', this.callbacks( '/monitor/hash' ), false );
          }

        },

        // remove event listeners
        events: function () {
          this.data.gui.$app.off();
        }

      },

      todos: {

        _root: 1,

        _data: 'todosComplete',

        // automatically collect flows with this state
        _capture: {has: 'todo'},

        // go to the default view
        _on: 'all',

        load: {

          _sequence: 1,

          _over: '.',

          // prevent sub-instances flows from controlling this one
          _perms: false,

          todos: function () {
            // create and instantiate Flows for each stored todo item
            ( JSON.parse( localStorage.getItem( 'todos-flow' ) ) || [] )
              .forEach(function ( storedTodoItem ) {
                (new Flow( TodoItemProgram )).target( 1, storedTodoItem.title, storedTodoItem.completed );
              });
          },

          hash: function () {
            this.data.router.parse( location.hash.substr( 2 ) );
          }

        },

        save: {

          _sequence: 1,

          items: function () {
            localStorage.setItem(
              'todos-flow',
              JSON.stringify(
                this.subs().map(function ( todoFlow ) {
                  return {
                    title: todoFlow.data.text,
                    completed: todoFlow.state.name === 'complete'
                  };
                })
              )
            );
          }

        },

        all: {

          _root: 1,

          _in: function () {
            this.data.gui['$tab_' + this.state.name].addClass( 'selected' );
          },

          _on: 'update',

          update: {

            _sequence: 1,

            _data: {
              subs: 0,
              total: 0,
              incomplete: 0,
              complete: 0
            },

            _in: function () {
              var subs = this.subs();
              this.data.subs = subs;
              this.data.total = subs.length;
              this.data.incomplete = subs.filter(function (inst) {
                return inst.state.name !== 'complete';
              }).length;
              this.data.complete = this.data.total - this.data.complete;
            },

            list: function () {
              var
                gui = this.data.gui,
                itemsToRemove = this.subs({on:[0, 'todo']}).filter(function (itemFlow) {
                  return !itemFlow.state.index || itemFlow.status('phase') === 'out'
                })
              ;

              // first - remove main listing from dom (speed bump?)
              gui.$todos.detach();
              // then - detach all children (as opposed to emptying the container - in order to preserve event listeners)
              gui.$todos.children().detach();
              // remove items if any are ready to go
              if (itemsToRemove.length) {
                itemsToRemove.unshift('remove');
                this.subs.apply(this, itemsToRemove);
              }
              // re-append each (filtered) todo's dom element
              gui.$todos.append.apply(
                gui.$todos,
                this.subs(null).map(function ( todoFlow ) {
                  return todoFlow.data.gui.$main;
                })
              );
              // re-append listing to main
              gui.$main.append(gui.$todos);

            },

            footer: function () {
              var $footer = this.data.gui.$footer;
              if (this.subs().length) {
                $footer.show();
              } else {
                $footer.hide();
              }
            },

            count: {

              remaining: function () {
                var
                  gui = this.data.gui,
                  tally = this.subs().length - this.subs({on:'complete'}).length
                ;
                gui.$count.html([
                    '<strong>' + tally + '</strong>',
                    ' item',
                    tally === 1 ? '' : 's',
                    ' left'
                  ].join( '' )
                );
              },

              completed: function () {
                var
                  clearButton = this.data.gui.$clear,
                  completedItemsCnt = this.subs({on:'complete'}).length
                ;
                // if there are completed todos...
                if (completedItemsCnt) {
                  // show and update button text
                  clearButton.text(
                    'Clear completed ( ' + completedItemsCnt + ' )'
                  ).show();
                } else { // otherwise, when no items are completed...
                  // hide the button
                  clearButton.hide();
                }
              }

            },

            markAll: function () {
              var
                gui = this.data.gui,
                totalStates = this.subs().length,
                // flag when all todos are on their "complete" state
                todosComplete = this.subs({on: 'complete'}).length === totalStates
              ;

              // show and set, or hide the toggle
              if (totalStates) {
                gui.$markAll.show().attr( 'checked', todosComplete);
              } else {
                gui.$markAll.hide();
              }
              // update all-done flag
              this.data.todosComplete = todosComplete;
            },

            // focus on the todo item that triggered this update, or the draft todo field
            focus: function () {
              var
                triggerFlow,
                todoItems,
                // the third to last state, which led to this function
                triggerState = this.status('trail').slice( -3, -2 )[0] || '',
                gui = this.data.gui
              ;

              // if no triggerstate, or started by a purge, hash change, or new item...
              if (triggerState.indexOf( 'purge' ) + 1 || triggerState.indexOf( 'hash' ) + 1 || triggerState.indexOf( 'draft' ) + 1) {
                // focus on draft field
                gui.$draftTodo.focus();
              } else if (triggerState.indexOf( 'markAll' ) + 1) { // or, when after marking all...
                // focus on the checkbox
                // (this should already have focus - just for completeness and integration tests)
                gui.$markAll.focus();
              } else { // otherwise, when the trigger state is unclear...
                // get store items available (to this view)
                todoItems = this.subs();
                // the first - if any - argument passed via the last .target() call
                triggerFlow = this.args(0);
                // get available todo notes
                todoItems = this.subs();
                // if the triggering flow is a stored item...
                if (triggerFlow && todoItems.length && todoItems.indexOf(triggerFlow) + 1) {
                  // re/focus on it's checkbox
                  triggerFlow.data.gui.$mark.focus();
                } else { // otherwise, when no triggering flow or it's not accessible (anymore)...
                  // focus on draft field (by default)
                  // gui.$draftTodo.focus();
                }
              }
            },

            // save after 5 seconds of inactivity
            save: {

              _import: '//todos/save/items/',

              // ensure this delay doesn't hold up other flows from executing
              _pendable: 1,

              // delay saving on non-opera browsers
              _in: function () {
                // if (!$.browser.opera) {
                //   this.wait( 5000 );
                // }
              }

            }

          },

          markAll: {

            _perms: false,

            _tail: '@root',

            _on: function () {
              var
                // alias collection of dom elements
                gui = this.data.gui,
                // global flag state
                initialFlag = this.data.todosComplete,
                // resolve flag target, based on whether the global checkbox is enabled
                destinationState = initialFlag ? '/' : '/complete'
              ;
              // detach main listing (speed bump?)
              gui.$todos.detach();
              // with all todos notes...
              this.subs().forEach(function (todoFlow) {
                // target the destination state
                todoFlow.target(destinationState);
              });
            }

          },

          draft: {

            _on: function () {
              this.data.gui.$draftTodo.focus();
            },

            type: {

              _on: function (evt) {
                if (evt && evt.keyCode === this.data.constants.RETURN_KEY) {
                  evt.preventDefault();
                  this.target( 'enter' );
                }
              },

              enter: {

                _data: 'text',

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
                    gui.$draftTodo.val( '' );
                  } else { // otherwise, when the trimmed value is invalid...
                    // if there was an untrimmed value...
                    if (original) {
                      // clear the draft todo field
                      gui.$draftTodo.val( '' );
                    }
                    // exit to type state
                    this.target( '../../' );
                  }
                },

                _on: function () {
                  // add a new todo item with the entered text
                  this.target( '/add', this.data.text);
                }

              }

            }

          },

          add: {
            _perms: '!sub',
            _on: function (text, done) {
              var
                gui = this.data.gui,
                todoItemFlow = new Flow(TodoItemProgram)
              ;
              // init todo item
              todoItemFlow.target(1, text, done);
              // if this state came from a keypress event...
              if (~this.status('trail')[0].indexOf( 'type' )) {
                // assume, this add call came from the draft state, so go back now that we're done
                this.go( '/draft' );
              }
              // update the listing
              this.go('/');
            }
          },

          monitor: {

            hash: '//todos/load/hash/',

            filterSelect: function (evt) {
              // if the spacebar is tapped while focused on the filters...
              if (evt.keyCode === this.data.constants.SPACE_KEY) {
                // set the hash to the link's hash
                location.hash = evt.target.hash;
              }
            }

          },

          purge: function () {
            var
              // get gui
              gui = this.data.gui,
              // get all completed flows
              completedFlows = this.subs('complete')
            ;

            // if there are completed flows...
            if (completedFlows.length) {
              // remove from dom (speedup)
              gui.$todos.detach();
              // with each completed flow...
              completedFlows.forEach(function (todoFlow) {
                // point flow to the zero-state
                todoFlow.go(0);
              });
            }
          },

          _out: function () {
            // unhighlight the corresponding tab
            this.data.gui['$tab_' + this.state.name].removeClass( 'selected' );
          }

        },

        active: {

          _capture: 'todo',

          _import: '//todos/all/'

        },

        completed: {

          _capture: 'complete',

          _import: '//todos/all/'

        }

      }

    },
 
    // this program defines all the possible states of a todo item
    TodoItemProgram = {

      // declare top-level data names - variables every state may need
      _data: [
        'gui',
        // use an object to define both the name and it's default value (use primitives only)
        {
          text: ''
        }
      ],

      // ensure this flow has an owner (the flow that created it)
      _in: function () {
        if (!this.owner()) {
          // (otherwise) return to the flow/null state
          this.target(0);
        }
      },

      // do all the setup in the program's root state
      _on: function ( text, done ) {
        var gui = {};

        // get our dom structure from the owner, then define references to various elements within
        gui.$main = this.owner().data.todoTpl.clone();
        gui.$view = gui.$main.find( '.view' );
        gui.$label = gui.$main.find( 'label' );
        gui.$field = gui.$main.find( '.edit' );
        gui.$mark = gui.$main.find( '.toggle' );
        gui.$remove = gui.$main.find( '.destroy' );

        // set a new value for the data variable "text"
        if (typeof text === 'string') {
          this.data.text = text;
        }

        // these handlers work when the current state can access the given (relative) path
        gui.$main.on( 'change', '.toggle', this.callbacks( 'complete|incomplete' ));
        gui.$main.on( 'dblclick', '.view', this.callbacks( 'edit' ));

        // these handlers work everytime, since the path is "absolute" - rooted to the program state
        gui.$main.on( 'keyup', '.edit', this.callbacks('//todo/edit/type'));
        gui.$main.on( 'click', '.destroy', this.callbacks('//todo/destroy'));
        gui.$main.on( 'blur', '.edit', this.callbacks('//todo'));

        // capture the gui object, for referencing within other states
        this.data.gui = gui;

        // go to complete state, if done
        this.go( done ? '//todo/complete' : '//todo/' );
      },

      // 
      set: {

        // t
        _over: function () {
          if (this.data.text) {
            this.go( '@self' );
          }
        },

        // other tags are defined by the state at this path
        _import: '//todo/update/note/'

      },

      todo: {

        _root: 1,

        // target passed to the owning flow, when this "child" enters, exits, and stops on this branch
        _owner: '/',

        complete: {

          _pendable: 0,

          _in: function () {
            var gui = this.data.gui;
            // check this box
            gui.$mark.attr( 'checked', 'checked' );
            // set class to show the task is completed
            gui.$main.addClass( 'completed' );
          },

          incomplete: function () {
             // exit "complete" state
            this.go( '/' );
          },

          _out: function () {
            var
              // alias the data store
              gui = this.data.gui;

            // remove checkbox state
            gui.$mark.removeAttr( 'checked' );
            // set class to show this task is incomplete
            gui.$main.removeClass( 'completed' );
          }

        },

        edit: {

          // inform owner that this item is editing
          _owner: '/edit',

          _in: function () {
            var gui = this.data.gui;

            // set value of field to the todo item value
            gui.$field.val( this.data.text);
            // set main class
            gui.$main.addClass( 'editing' );
          },

          _on: function () {
            // select the text field
            this.data.gui.$field.select();
          },

          type: {

            // don't update owner while typing
            _owner: -1,

            _on: function ( evt ) {
              var constants = this.owner().data.constants;

              if (evt && (evt.keyCode === constants.RETURN_KEY || evt.keyCode === constants.ESCAPE_KEY )) {

                evt.preventDefault();

                // blur the field - triggers exit of this state
                evt.target.blur();

                if (evt.keyCode === constants.ESCAPE_KEY) {
                  // first revert the field value
                  this.go( '/edit/revert' );
                }

              }
            }

          },

          // revert input to the original value
          revert: function () {
            this.data.gui.$field.val(this.data.text);
          },

          _out: function () {
            var
              gui = this.data.gui,
              enteredValue = $.trim( gui.$field.val() ),
              originalValue = this.data.text
            ;

            if (enteredValue !== originalValue) {
              if (enteredValue.length) {
                // capture new value
                this.data.text = enteredValue;
                // save the note
                this.go( '/update' );
              } else {
                // destroy this todo
                this.target( '/destroy' );
              }
            }
            // set main class
            gui.$main.removeClass( 'editing' );
          }
        },

        update: {

          _sequence: 1,

          note: function () {
            var
              gui = this.data.gui,
              text = this.data.text
            ;
            // set text of todo row - preserve whitespace
            gui.$label.html( text.replace(/\s/g, '&nbsp;' ) );
            // set value of todo field (since it may have been trimmed)
            gui.$field.val( text );
          }

        },

        destroy: function () {
          // just exit the flow
          this.target(0);
        }

      },

      _out: function () {
        var gui = this.data.gui;

        if (gui) {
          // rip events
          gui.$main.off();
        }
      }

    };

  window.TodoApp = new Flow( TodoProgram );
  TodoApp.go( 1 );

})( window );