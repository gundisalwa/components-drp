/* jshint devel:true */


// Main wrapper
window.drp = ( function (  Backbone , _ , Mustache , Base , $ ) {

  'use strict';




/***********************************************************************************************************************
 *
 * Base Generic Classes
 *
 **********************************************************************************************************************/

  // BaseBone: returns Base.js modification that includes Backbone.Events.
  //   Also has several static helpers to augment constructors with .extend
  //   and events functionality.
  var BaseBone = ( function ( _ , Base , Backbone ) {
    //'use strict';
    var Events = Backbone.Events,
    		rest = _.rest,
    		noop = function (){};


    //--------------------------------//

    function extendClass ( TargetClass  ) {
    	var NewClass = Base.extend.apply( TargetClass, rest( arguments ) );
    	delete( NewClass.prototype.extend ); // TODO: Don't include the instance method squasher?
      return NewClass;
    }

    function addSelfExtend ( TargetClass ) {
      return extendClass( TargetClass, {}, { extend: Base.extend } );
    }

    function addEvents ( TargetClass ) {
      return extendClass( TargetClass , Events );
    }

    function basebonify ( TargetClass ) {
      return extendClass( 
      				addEvents( addSelfExtend( TargetClass ) ) , 
      				arguments[ 1 ] ,
      				arguments[ 2 ]
      			);
    }

    // Returns an empty constructor augmented with Base.js inheritance and Backbone Events.
    var exports = basebonify( noop );

    //--------------------------------//

    exports.extendClass = extendClass;
    exports.basebonify = basebonify;
    exports.convert = basebonify;

    return exports;

  } )( _ , Base , Backbone );


  // Base Collection
  var BaseCollection = ( function ( BaseBone ) {
    //'use strict';

    function SeedCollection () {
      this.push.apply( this, arguments );
    }
    SeedCollection.prototype = [];

    // We need to explicitly pass a constructor because we don't want Base.js to do
    // Array.apply, which will break.
    var Collection = BaseBone.basebonify( SeedCollection , {
      constructor: SeedCollection,
      push: function ( ) {
        var ret = this.base.apply( this , arguments ),
        args = [].slice.call( arguments );
        for( var i = 0, len = args.length; i < len; i++ ) {
          this.trigger( 'add', args[ i ], ret - len + i );
        }
        this.trigger( 'change' );
        return ret;
      },

      pop: function ( ) {
        var ret = this.base.apply( this, arguments );
        this.trigger( 'remove', ret, this.length );
        this.trigger( 'change' );
        return ret;
      }
    } );

    //--------------------------------//

    return Collection ;

  } )( BaseBone );







/***********************************************************************************************************************
 *
 * Base Components
 *
 **********************************************************************************************************************/
  

  // Base Model
  var BaseModel = ( function ( _ , BaseBone , Backbone ) {
    //'use strict';

    var Model = BaseBone.basebonify( Backbone.Model );

    return Model;

  } )( _ , BaseBone , Backbone );



  // Base View
  var BaseView = ( function ( _ , $ , Mustache , BaseBone , Backbone , BaseModel ) {
    //'use strict';

    var identity = _.identity,
    		isString = _.isString,
        isEqual = _.isEqual;

    //--------------------------------//
    

    //--------------------------------//


    var View = BaseBone.basebonify( Backbone.View ,{
      constructor: function ( config ) {
        this.base.apply( this, arguments );

        config = config || {};

        if ( config.target ){
          this.setElement( $( config.target ) );
        }

        this.setViewModel( new BaseModel() );
      },

      setViewModel: function ( model ){
        this.viewModel = model;
      },
      getViewModel: function (){
        return this.viewModel;
      },

      getElement: function (){
      	return this.$el;
      },
      getTemplate: function ( key ) {
      	return ( isString( key ) && this.templates && this.templates[key] ) || this.template;
      },

      render: function ( model ) {
      	
        this.getViewModel().set( model );

        // Using .hasChanged instead of binding a callback to synchronize. 
        // TODO: Evaluate if async is better.
        if ( this.getViewModel().hasChanged() ){          
          this.getElement().empty();
          this.renderParent( this.getElement() , this.getViewModel() );
          this.renderChildren( this.getElement() , this.getViewModel() );
        }

        return this.getElement();
      },

      // TODO: Should we have to pass the target? 
      // Or should it be taken from this.$el, for coherence???
      renderParent: function ( target , model ) {
        return $( target ).html( this.renderTemplate( this.getTemplate() , model.toJSON() ) );
      },
      renderTemplate: function ( template , data ){
      	return Mustache.render( template ,  data );
      },
      renderChildren: identity

    } );

    //--------------------------------//

    return View;

  } )( _ , $ , Mustache , BaseBone , Backbone , BaseModel );



  // Base Element
  var BaseElement = ( function ( _ , BaseBone , BaseView , BaseModel  ) {
    //'use strict';

    var isFunction = _.isFunction,
		    isArray = _.isArray,
		    reduce = _.reduce,
		    identity = _.identity,
		    noop = function (){},
        partial = _.partial,
		    extend = _.extend;

    //--------------------------------//

    function normalizeInputHandlers ( inputHandlers ) {

      var normalized =
			      isArray ( inputHandlers ) ? inputHandlers :
			      isFunction ( inputHandlers ) ? [ inputHandlers ] :
			      [];

      return normalized;
    }

    function runInputHandlers ( newData , inputHandlers , model  ) {
      var transformedData = reduce( inputHandlers , function ( acc , handler ) {
  				return handler( acc, model );
				}, newData );
      return transformedData;
    }

    function renderView ( el ){
      return el.view.render( el.getViewModel() );
    }

    function bindModelsToView ( el ){
      el.listenTo( el.state , 'change' , partial( renderView , el ) );
      el.listenTo( el.params , 'change' , partial( renderView , el ) );
    }

    function bindControl ( el ){
      bindModelsToView ( el );
      el.bindControl();
    }

    //--------------------------------//


    var Element = BaseBone.extend( {

      constructor: function ( opts ) {
        opts = opts || {};

        this.base( opts );

        // Set inputModel
        this.params =  new BaseModel( opts.params );

        // Set model
        this.state = new BaseModel( opts.state );

        // Set view and view target
        var viewOpts = extend( { target: opts.target } , opts.viewOpts );
        this.view = this.getNewView( viewOpts );

        // Main controller events binding
        bindControl( this );

      },

      // API
      update: function ( newInput ){
      	// TODO: promisses???
        this.params.set( newInput ); 
        this.trigger( 'update' , newInput );
      	return this.getViewElement();
      },
      render: function (){
      	// TODO: promisses???
        var $el = renderView( this );
        this.trigger( 'render' , $el );
      	return $el;
      },


      // 
      getNewView: function (  viewOpts ) {
        // Override this to get a different view
        return ( new BaseView( viewOpts ) );
      },
      getViewElement: function () {
        return ( this.view && this.view.getElement() );
      },
      getViewModel: function (){
        return {
          input: this.params.toJSON(),
          state: this.state.toJSON()
        }
      },

   		// Control
      bindControl: noop,



    } );

    return Element;

  } )( _ , BaseBone , BaseView , BaseModel );










/***********************************************************************************************************************
 *
 * Predefined Element
 *
 **********************************************************************************************************************/


  // View Definition
  var PredefinedView = ( function ( BaseView ) {
    //'use strict';

    var View = BaseView.extend( {
      events: {
        'click': 'click'
      },
      template:
	      '<div>' +
	      '  <span>{{ label }}</span>' +
	      '</div>',
      click: function ( ) {
        this.trigger( 'click' );
      }

    } );

    return View;

  } )( BaseView );

  // Element/Controller Definition
  var PredefinedElement = ( function ( BaseElement , PredefinedView ) {
    //'use strict';

    var Element = BaseElement.extend( {
      getNewView: function (  viewOpts ) {
        return ( new PredefinedView( viewOpts ) );
      },
      getViewModel: function ( ){
        return { label: this.params.get('label') }
      },
      bindControl: function ( ) {
        var myself = this;

        myself.listenTo ( myself.view , 'click' , function ( rangeModifier ) {
          myself.trigger( 'activate' , myself.params.get( 'getRange' )() );
        } );

      }

    } );

    return Element;

  } )( BaseElement , PredefinedView );











/***********************************************************************************************************************
 *
 * Calendar
 *
 **********************************************************************************************************************/


  // View Definition
  var CalendarView = ( function ( BaseView , $ , _ ) {
    //'use strict';

    var isBoolean = _.isBoolean,
    		partial = _.partial,
    		bind = _.bind,
    		forEach = _.forEach;

    //--------------------------------//


    function bindToPage ( target , callback ) {
      return $( document ).on( 'click', function ( ev ) {
          // The second part of this test accounts for when the original target is already detached
          // from the DOM, possibly because another event triggered a rerender.
          if ( ! $.contains( target , ev.target ) && $.contains( document.body , ev.target ) ){
            callback();
          }
        } );
    }


    //--------------------------------//


    var View = BaseView.extend( {
      events: {
        'click .rangeDisplay': 'toggleMenu'
      },
      template:
	      '<div class="calendarContainer">' +
	      '  <div class="calendarModes">' +
	      '  </div> ' +
	      '  <div class="calendarItems"> ' +
	      '  </div> ' +
	      '</div>'
    } );


    return View;

  } )( BaseView , $ , _ );


  // DRP Element
  var CalendarElement = ( function ( BaseElement , DrpView  ) {
  	//'use strict';
	
		var forEach = _.forEach,
				extend = $.extend,
				without = _.without,
				isArray = _.isArray,
				isObject = _.isObject,
				isEqual = _.isEqual,
				clone = function ( v ){
					return !isObject(v) ? v : extend( true, isArray(v) ? [] : {} , v );
				};


	  var Element = BaseElement.extend( {
      getNewView: function (  viewOpts ) {
        return ( new DrpView( viewOpts ) );
      },
	    bindControl: function ( ) {
	      var myself = this;

	      myself.listenTo( myself.view , 'toggleMenu' , function ( value ) {
	    			myself.state.set( 'isVisible', value );
	  			} );

	      myself.listenTo( myself.view , 'changeRange' , function ( newRange ){
	      	// TODO: Blindly assuming the newRange only has range related properties.
	      	myself.state.set( newRange );
	      });

        // TODO
	      myself.listenTo( myself.view , 'select' , function( selectedItem ){
	      	var items = clone( myself.state.get('predefined') );
	      	forEach( items, function ( item ){
	      		item.isSelected = ( isEqual( item , selectedItem ) );
	      	});
	      	myself.state.set('predefined', items );
	     	});

	    }
	  } );

	  return Element;

	} )( BaseElement, DrpView );








/***********************************************************************************************************************
 *
 * Day Calendar
 *
 **********************************************************************************************************************/


  // View Definition
  var DayCalendarView = ( function ( BaseView , $ , _ , moment ) {
    //'use strict';

    var isBoolean = _.isBoolean,
    		partial = _.partial,
    		bind = _.bind,
    		partition = _.partition,
    		forEach = _.forEach,
    		clone = _.clone,
    		isEmpty = _.isEmpty,
    		first = _.first,
    		rest = _.rest;

    //--------------------------------//
    
    function selfOrDescendant( target , selector ){
    	return $(target).find(selector).addBack(selector);
    }

    function renderBody ( view , model ){
      var $body = $( view.renderTemplate( view.getTemplate('body'), model ) ),
          $rows = selfOrDescendant( $body , '.rows' ),
          rowSize = model.rowSize,
          items = clone( model.range ),
          row;

      while( !isEmpty( items ) ){
        row = { items: first ( items , rowSize ) };
        $rows.append( renderRow( view , row  ) );
        items = rest( items ,  model.rowSize );
      }

      return $body;
    }

    function renderRow ( view , model ){
      var $row = $( view.renderTemplate( view.getTemplate('row') , model ) ),
          $items = selfOrDescendant( $row , '.items' );

      forEach( model.items , function ( item ){
        $items.append( renderItem( view , item ) );
      });

      return $row;
    }

    function renderItem ( view , model ){
      var $item = $( view.renderTemplate( view.getTemplate('item') , model ) );

      if ( !model.isDisabled ){
        $item.click( partial( selectDate , view , model.date.clone() ) );
      }

      return $item;
    }

    function selectDate ( view , date ){
      view.trigger('selectDate', date );
    }

    //--------------------------------//


    var View = BaseView.extend( {
    	templates: {
    		row:  '<tr class="calendarRow items"></tr>',
    		body: '<table><thead class="calendarHeader"></thead><tbody class="rows"></tbody></table>',
    		item: '<td><div style=" {{#isDisabled}}color: grey;{{/isDisabled}} {{#isSelected}} background: green;{{/isSelected}}">{{ label }}</div></td>'
    	},
	    renderParent: function ( target , model ){
        return $( target ).append( renderBody( this , model.toJSON() ) );
	    }
	    
    } );


    return View;

  } )( BaseView , $ , _ , moment );





  // DRP Element
  var DayCalendarElement = ( function ( BaseElement , DayCalendarView  ) {
  	//'use strict';
	
		var forEach = _.forEach,
				extend = $.extend,
				without = _.without,
				isArray = _.isArray,
				isObject = _.isObject,
				isEqual = _.isEqual,
				clone = function ( v ){
					return !isObject(v) ? v : extend( true, isArray(v) ? [] : {} , v );
				};

		//--------------------------------//
    
    	function getLimit ( reference , limit ){
    		var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
	    	return moment( reference ).clone()[op]('month')[op]('week');
    	}

    //--------------------------------//


	  var Element = BaseElement.extend( {

      // View functions
      getNewView: function (  viewOpts ) {
        return ( new DayCalendarView( viewOpts ) );
      },
      getViewModel: function ( ){
        var model = this.params,
            date = model.get('date'),
            max = model.get('max'),
            min = model.get('min'),
            newRange = this.generateRange( date , min , max , 'day' , 'month' );
        return { range: newRange , rowSize: 7 }
      },

	    // Controller
	    bindControl: function ( ) {
	    	var myself = this;

	    	myself.listenTo( myself.view , 'selectDate', function ( newDate ){
	    		myself.trigger('selectDate' , newDate );
	    	});

      },

	    generateRange: function ( date , min , max , grain , span ){
	    	var myself = this,
	    			start  = getLimit( date , 'start' ),
	    			end    = getLimit( date , 'end' ),
	    			current   = start.clone(),
	    			dates = [];

	    	while ( current.isBefore( end ) ){
	    		dates.push( {
	    			date: current,
						label: current.date(),
						isSelected: current.isSame( date , grain ),
						isDisabled: 
              ( min && current.isBefore( min , grain ) ) || 
              ( max && current.isAfter ( max , grain ) ) || 
              ( span && !current.isSame( date , span ) )
					} );

	    		current = current.clone();
					current.add(1, 'days');
	    	}

	    	return dates;
	    }

	  } );

	  return Element;

	} )( BaseElement , DayCalendarView  );

















/***********************************************************************************************************************
 *
 * DRP
 *
 **********************************************************************************************************************/


  // View Definition
  var DrpView = ( function ( BaseView , $ , _ , PredefinedElement , DayCalendarElement ) {
    //'use strict';

    var isBoolean = _.isBoolean,
    		partial = _.partial,
    		bind = _.bind,
    		forEach = _.forEach;

    //--------------------------------//


    function bindToPage ( target , callback ) {
      return $( document ).on( 'click', function ( ev ) {
          // The second part of this test accounts for when the original target is already detached
          // from the DOM, possibly because another event triggered a rerender.
          if ( ! $.contains( target , ev.target ) && $.contains( document.body , ev.target ) ){
            callback();
          }
        } );
    }


    //--------------------------------//


    var View = BaseView.extend( {
      events: {
        'click .rangeDisplay': 'toggleMenu'
      },
      template:
	      '<div class="drpContainer">' +
	      '  <div class="rangeDisplay">' +
	      '    <span> {{ range }} </span> ' +
	      '  </div> ' +
	      '  <div class="dropdown {{^isVisible}}hidden{{/isVisible}}"> ' +
	      '    <br> ' +
	      '    <div class="items"> ' +
	      '      {{#predefined}} ' +
	      '        <div class="selectionItems {{#isSelected}}selected{{/isSelected}} "> ' +
	      '        </div>' +
	      '      {{/predefined}}' +
	      '    </div> ' +
	      '    <br> ' +
	      '    <div class="startCalendar"></div> ' +
	     	'    <br> ' +
	      '    <div class="endCalendar"></div> ' +
	      '    <br> ' +
	      '    <div class="speedyCalendar"></div> ' +
	      '    <br> ' +
	      '    <div class="slowPokeCalendar"></div> ' +
	      '  </div> ' +
	      '</div>',
      toggleMenu: function ( predicate ) {
        var newPredicate =  isBoolean( predicate ) ? predicate : !( this.getViewModel().get('isVisible') );
        this.trigger( 'toggleMenu', newPredicate );
      },
      constructor: function () {
        this.base.apply( this, arguments );

        var closeMenu = partial( bind( this.toggleMenu , this ) , false );
        // TODO: verify if there are no ghost events.
        bindToPage( this.el , closeMenu );

      },
      renderChildren: function ( target ,  model ) {
      	var $items = $(target).find( '.selectionItems' ),
      			myself = this;



      	forEach( model.get('predefined') , function ( config , idx ) {
			    
			    var item = new PredefinedElement( {
			      target: $( $items[idx] )
			    } );
			    
			    item.update( config );
			    myself.listenTo( item , 'activate' , function ( newRange ) {
			    	myself.trigger( 'changeRange' , newRange );
			    	myself.trigger( 'select' , config );
			    } );
			  } );



      	var startCalendar = new DayCalendarElement({
      		target: $(target).find('.startCalendar')
      	});
      	startCalendar.update({
      		date: model.get('start')
      	});
    		myself.listenTo( startCalendar , 'selectDate' , function ( newStart ) {
		    	myself.trigger( 'changeRange' , { start: newStart } );
		    	myself.trigger( 'select' , null );
		    } );



      	var endCalendar = new DayCalendarElement({
      		target: $(target).find('.endCalendar')
      	});
      	endCalendar.update({
      		date: model.get('end')
      	});
      	myself.listenTo( endCalendar , 'selectDate' , function ( newEnd ) {
		    	myself.trigger( 'changeRange' , { end: newEnd } );
		    	myself.trigger( 'select' , null );
		    } );



		    var speedyCalendar = new DayCalendarElement({
      		target: $(target).find('.speedyCalendar')
      	});
      	speedyCalendar.update({
      		date: ( model.get('end') ? model.get('end').clone().add(42,'day') : null )
      	});
/*      	myself.listenTo( endCalendar , 'selectDate' , function ( newEnd ) {
		    	myself.trigger( 'changeRange' , { end: newEnd } );
		    	myself.trigger( 'select' , null );
		    } );
*/

		    var slowPokeCalendar = new DayCalendarElement({
      		target: $(target).find('.slowPokeCalendar')
      	});
      	slowPokeCalendar.update({
      		date: (model.get('start') ? model.get('start').clone().add(4,'day') : null )
      	});

      }

    } );


    return View;

  } )( BaseView , $ , _ , PredefinedElement , DayCalendarElement );


  // DRP Element
  var DrpElement = ( function ( BaseElement , DrpView  ) {
  	//'use strict';
	
		var forEach = _.forEach,
				extend = $.extend,
				without = _.without,
				isArray = _.isArray,
				isObject = _.isObject,
				isEqual = _.isEqual,
				clone = function ( v ){
					return !isObject(v) ? v : extend( true, isArray(v) ? [] : {} , v );
				};



	  var Element = BaseElement.extend( {

      getNewView: function (  viewOpts ) {
        return ( new DrpView( viewOpts ) );
      },
      getViewModel: function (){
        var start = this.params.get('start'),
            end = this.params.get('end'),
            range = start.format( 'YYYY-MM-DD' ) + ' To ' + end.format( 'YYYY-MM-DD' );

        return {
          range: range,
          start: start,
          end:   end,
          predefined: this.state.get('predefined'),
          isVisible: this.state.get('isVisible')
        }
      },

	    bindControl: function ( ) {
	      var myself = this;

        // TODO: temporarily copying predefined to internal state
        myself.listenTo( myself.params , 'change:predefined' , function ( inputModel , predefined ){
          myself.state.set( 'predefined' , predefined );
        });

	      myself.listenTo( myself.view , 'toggleMenu' , function ( value ) {
	    			myself.state.set( 'isVisible', value );
	  			} );

	      myself.listenTo( myself.view , 'changeRange' , function ( newRange ){
	      	// TODO: Blindly assuming the newRange only has range related properties.
	      	myself.trigger( 'change' , newRange );
	      });

	      myself.listenTo( myself.view , 'select' , function( selectedItem ){
	      	var items = clone( myself.state.get('predefined') );
	      	forEach( items, function ( item ){
	      		item.isSelected = ( isEqual( item , selectedItem ) );
	      	});
	      	myself.state.set('predefined', items );
	     	});

	    }
	  } );

	  return Element;

	} )( BaseElement, DrpView );
















/***********************************************************************************************************************
 *
 * Sandbox
 *
 **********************************************************************************************************************/


  var drp = new DrpElement( {
    target: '#somethingSomethingDarkside'
  } );


  var items = [
    {	label: 'Month to Date', getRange: function ( ){ return { start: moment().startOf('month') , end: moment() } } },
    { label: 'Last 7 Days', getRange: function ( ){ return { start: moment().add(-7,'days') , end: moment() } } },
    { label: 'Year to Date', getRange: function ( ){ return { start: moment().startOf('year'), end: moment() } } }
    ]

  drp.update( {
    'start': moment(),
    'end': moment(),
    'predefined': items
  } );

  drp.listenTo( drp , 'change' , function ( newRange ){
    drp.update( newRange );
  });



  var exports = {
    drp: drp,
    BaseBone: BaseBone
  };


  /* ------------------------------------------ */




  /* ------------------------------------------ */

  return exports;

} )( window.Backbone , window._ , window.Mustache, window.Base, window.$ );



