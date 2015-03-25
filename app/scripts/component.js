/* jshint devel:true */



// Main wrapper
window.drp = ( function (  Backbone , _ , Mustache , Base , $ ) {

	'use strict';




	// BaseBone Mixin: adds events and Base.js extend methods to target class
	var BaseBone = ( function ( _ , Base , Backbone ){
		//'use strict';

		var rest = _.rest;

		//--------------------------------//
				
		function extendClass ( TargetClass  ){
			return Base.extend.apply( TargetClass, rest( arguments ) );
		}

		function addSelfExtend ( TargetClass ){
			return extendClass( TargetClass, {}, { extend: Base.extend });
		}

		function addEvents ( TargetClass ){
			return extendClass( TargetClass , Backbone.Events );
		}

		function basebonify ( TargetClass ){
			var newClass = addSelfExtend( TargetClass );
			newClass = newClass.extend( Backbone.Events );
			newClass = newClass.extend( arguments[1], arguments[2] );
			return newClass;
		}


		var BaseBone = {};


		//--------------------------------//

		BaseBone.extendClass = extendClass;
		BaseBone.basebonify = basebonify;
		BaseBone.extendWithEvents = basebonify;

		return BaseBone;

	})( _ , Base , Backbone );


	// Base Collection 
	var BaseCollection = ( function ( BaseBone ){
		//'use strict';

		var Collection = BaseBone.basebonify( Array , {
			push: function ( ){
				var ret = this.base.apply( this , arguments ),
						args = [].slice.call( arguments );
				for(var i = 0, len = args.length; i < len; i++) {
					this.trigger('add', args[i], ret - len + i);
				}
  			this.trigger('change');
  			return ret;
			},

			pop: function ( ){
				var ret = this.base.apply(this, arguments);
			  this.trigger('remove', ret, this.length);
			  this.trigger('change');
			  return ret;
			}
		});

		//--------------------------------//

		return Collection ;

	})( BaseBone );

	//--------------------------------//

	// Base View 
	var BaseView = ( function ( _ , $ , Mustache , BaseBone , Backbone ){
		//'use strict';

		var View = BaseBone.basebonify( Backbone.View ,{
			initialize: function ( config ){
				// Create model bindings.
				// TODO: Create smarter bindings to bind only to used properties.
				this.setModel( config.model );
				this.setElement( $( config.target ) );
			},
			getModel: function () {
				return this.model;
			},
			setModel: function ( model ) {
				this.stopListening();
				this.model = model;
				this.bindToModel();
			},
			bindToModel: function (){
				this.listenTo( this.getModel() , 'change', this.render );	
			},
			render: function (){
				return this.$el.html( Mustache.render( this.template, this.model.toJSON() ) );
			}

		});

		//--------------------------------//

		return View;

	})( _ , $ , Mustache , BaseBone , Backbone );





	// Base Model
	var BaseModel = ( function ( _ , BaseBone , Backbone ){
		//'use strict';

		var Model = BaseBone.basebonify( Backbone.Model );

		return Model;

	})( _ , BaseBone , Backbone );




	var BaseController = ( function ( _ , BaseBone, BaseCollection ){
		//'use strict';

		function SeedController ( views , models ){
			this.views = new BaseCollection( views );
			this.models = new BaseCollection( models );
		}

		var Controller = BaseBone.basebonify( SeedController , {
			addView: function ( ){
				var ret = this.views.push.apply( this.views , arguments );
				return ret;
			},
			removeView: function ( ){
				var ret = this.views.pop.apply( this.views , arguments );
				return ret;
			},
			addModel: function ( ){
				var ret = this.models.push.apply( this.models , arguments );
				return ret;
			},
			removeModel: function ( ){
				var ret = this.models.pop.apply( this.models , arguments );
				return ret;
			}
		});
		
		return Controller;


	})( _ , BaseBone , BaseCollection );





	// Base Element
	var BaseElement = ( function ( Base, _  ){
		//'use strict';

		var isFunction = _.isFunction,
				isArray = _.isArray,
				reduce = _.reduce;

		var Element = Base.extend({
			initialize: function ( opts ){

				this.base( opts );

				// Normalized input handlers
				this._normalizeInputHandlers( opts.inputHandlers );


			},
			_normalizeInputHandlers: function (){
				this._inputHandlers = 
					isArray( this.inputHandlers ) ? this.inputHandlers :
					isFunction( this.inputHandlers ) ? [ this.inputHandlers ] :
					[];
			},
			_bindOutputHandlers: function(){

			},
			_inputController: function ( newData ){
				var model = this.model,
						transformedData = reduce( this._inputHandlers , function ( acc, handler ){
							return handler( acc, model );
						}, newData );

				model.set( transformedData );
			},
			_getViewElement: function (){
				return this.view.$el;
			},
			update: function( newData ){
				// TODO: Add promises here!! ??
				this._inputController( newData );
				return this._getViewElement();
			}
		});

		return Element;

	})( Base, _ );




	// ---------------------------------------- //


	// Model Definition
	var DrpModel = ( function ( BaseModel ){
		//'use strict';

		var Model = BaseModel.extend({
			defaults: {
				start: null,
				end: null,
				grain: null,
				predefined: [],
				displayFormatter: function( date, level ){

				}
			},
			initialize: function (){
				// Computed Properties (?)
				this.listenTo( this, 'change:start' , function () {

				});

			}
		});

		return Model;

	})( BaseModel );



	// View Definition 
	var DrpView = ( function ( BaseView, $, _ ){
		//'use strict';

		var isBoolean = _.isBoolean;

		var View = BaseView.extend({
			events: {
				'click .rangeDisplay' : 'toggleMenu'
			},
			template: 
				'<div>' +
				'  <div class="rangeDisplay">' +
				'    <span> {{ start }} to {{ end }} </span> ' +
				'  </div> ' +
				'  <div class="dropdown {{^isVisible}}hidden{{/isVisible}}"> ' +
				'	   <div class="buttons">AAAAAAAAAAAAAAAA ' +
				'    </div> ' +
				'    <div class="items"> ' +
				'      {{#predefined}}' +
				'        <div class="predefined">{{label}}</div>' +
				'      {{/predefined}}' +
				'    </div> ' + 
				'  </div> ' +
				'</div>',
			toggleMenu: function ( predicate ){
				var newPredicate =  isBoolean( predicate ) ? predicate : !this.model.get('isVisible');
				this.trigger('toggleMenu', newPredicate );
			},
			initialize: function (){
				this.base.apply( this, arguments );

				var view = this;

				// TODO: verify if there are no ghost events.
				$('html').on('click', function ( ev ){
					// The second part of this test accounts for when the original target is already detached
					// from the DOM, possibly because another event triggered a rerender.
					if ( ! $.contains( view.el, ev.target ) && $.contains( document.body , ev.target ) ){
						view.toggleMenu( false );
					}
				});
			}
			
		});


		return View;

	})( BaseView , $, _ );


	// Element Definition
	/*var Drp = ( function ( BaseElement, View, Model ){
		//'use strict';

		var Element = BaseElement.extend({

		});


	})( BaseElement, DrpView, DrpModel );*/



	var myModel  = new DrpModel({}),
			myModel2 = new DrpModel({});

	var myView = new DrpView({
		model: myModel,
		target: '#somethingSomethingDarkside' // target?? = jQuery element  ;  
	});




	var myController = new BaseController();

	myController.listenTo( myView, 'toggleMenu', function( value ){
		myModel.set('isVisible', value );
		myModel2.set('isVisible', value );
	});


	myModel.set('start', 1234);
	myModel.set('end', 4567);
	myModel.set('predefined', [
		{
			label: 'P1'
		},
		{
			label: 'P2'
		},
		{
			label: 'P3'
		}
	]);


	myModel2.set('start', 'abc');
	myModel2.set('end', 'def');
	myModel2.set('predefined', [
		{
			label: 'K1'
		},
		{
			label: 'K2'
		},
		{
			label: 'K3'
		}
	]);


	var exports = {
		model: myModel,
		view: myView,
		model2: myModel2
	}


	/* ------------------------------------------ */




	/* ------------------------------------------ */

	return exports
	
})( window.Backbone , window._ , window.Mustache, window.Base, window.$ );

// 
// 
// 
// 
// 
// 
// 
// 
// 

