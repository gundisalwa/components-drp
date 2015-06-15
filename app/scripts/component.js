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
    var Events = Backbone.Events;

    function noop (){}

    //--------------------------------//

    function extendClass ( TargetClass  ) {
      var NewClass = Base.extend.apply( TargetClass, _.rest( arguments ) );
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

    return BaseBone.basebonify( Backbone.Model , {
      getSetter: function ( attributeName ){
        return _.bind( this.set , this , attributeName );
      },
      getGetter: function ( attributeName ){
        return _.bind( this.get , this , attributeName );
      }
    } );

  } )( _ , BaseBone , Backbone );



  var BaseController = ( function ( _ , BaseBone ){
    //'use strict';

    return BaseBone.extend( {
      constructor: function ( element ){

        this.setElement( element );

        // Create Bindings
        this.listenTo( element.getState()  , 'change' , this.renderView  );
        this.listenTo( element.getParams() , 'change' , this.renderView  );

      },
      setElement: function ( element ){
        this.element = element;
      },
      getElement: function ( ){
        return this.element;
      },
      model2viewModel: function ( state , params ){
        // Default Implementation of model -> viewModel transformation. Override as needed.
        return {
          state: state,
          params: params
        };
      },

      renderView: function ( ){
        var state = this.getElement().getState().toJSON(),
            params = this.getElement().getParams().toJSON(),
            vm = this.model2viewModel( state , params );
        return this.getElement().getView().render( vm );
      }


    } );

  } )( _ , BaseBone );



  // Base View
  var BaseView = ( function ( _ , $ , Mustache , BaseBone , Backbone , BaseModel ) {
    //'use strict';

    return BaseBone.basebonify( Backbone.View ,{
      constructor: function ( config ) {
        this.base.apply( this, arguments );

        if ( config && config.target ){
          this.setElement( $( config.target ) );
        }

        this.setModel ( new BaseModel() );
      },

      setModel: function ( model ){
        this.model = model;
      },
      getModel: function (){
        return this.model;
      },

      getElement: function (){
        return this.$el;
      },
      getTemplate: function ( key ) {
        return ( _.isString( key ) && this.templates && this.templates[ key ] ) || this.template;
      },

      render: function ( model ) {

        this.getModel().set( model );

        // Using .hasChanged instead of binding a callback to synchronize.
        // TODO: Evaluate if async is better.
        if ( this.getModel().hasChanged() ){
          this.getElement().empty();
          this.renderParent( this.getElement() , this.getModel() );
          this.renderChildren( this.getElement() , this.getModel() );
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
      renderChildren: _.identity

    } );

  } )( _ , $ , Mustache , BaseBone , Backbone , BaseModel );



  // Base Element
  var BaseElement = ( function ( _ , BaseBone , BaseView , BaseModel  ) {
    //'use strict';

    return BaseBone.extend( {

      constructor: function ( opts ) {
        this.base( opts );

        // Set Params model
        this.setParams( new BaseModel( opts.params ) );

        // Set State model
        this.setState( new BaseModel( opts.state ) );

      },

      // API
      update: function ( newInput ){
        // TODO: promisses???
        this.getParams().set( newInput );
        this.trigger( 'updated' , newInput );
        return this.getView().getElement();
      },
      render: function (){
        // TODO: promisses???
        this.getController().renderView( );
        this.trigger( 'render' , this.getView().getElement() );
        return this.getView().getElement();
      },

      // private definitions
      setView: function( view ){
        this.view = view;
      },
      getView: function(){
        return this.view;
      },

      setController: function( controller ){
        this.stopListening( this.controller );
        this.listenTo( controller , 'all', this.routeControllerEvent );
        this.controller = controller;
      },
      getController: function(){
        return this.controller;
      },
      routeControllerEvent: function ( ){
        this.trigger.apply( this , arguments );
      },

      setParams: function( params ){
        this.params = params;
      },
      getParams: function(){
        return this.params;
      },
      setState: function( state ){
        this.state = state;
      },
      getState: function(){
        return this.state;
      }

    } );

  } )( _ , BaseBone , BaseView , BaseModel );


/***********************************************************************************************************************
 *
 * Predefined Element
 *
 **********************************************************************************************************************/

  var DrpBaseController = ( function ( _ , BaseController ){
    // 'use strict';

    return BaseController.extend( {
      listenTo: function ( observed , eventName , callback ){
        var modifiedCallback = callback;

        if ( eventName.match( /^change:.*$/ ) ){
          var boundcallback = _.bind( callback , this );

          modifiedCallback = function ( model , value , options ){
            return boundcallback( value , options );
          };
        };

        return this.base( observed , eventName , modifiedCallback );
      }
    } );

  } )( _ , BaseController );







/***********************************************************************************************************************
 *
 * Predefined Element
 *
 **********************************************************************************************************************/

  // Controller Definition
  var PredefinedController = ( function ( BaseController ){
    //'use strict';

    return BaseController.extend( {
      constructor: function ( element ){
        this.base( element );

        // Create Bindings
        this.listenTo ( element.getView() , 'click' , this.activate );
      },
      model2viewModel: function ( state , params ){
        return {
          label: state.label
        };
      },
      activate: function (){
        this.trigger( 'activate' , this.getElement().getParams().get( 'getRange' )() );
      }
    } );

  } )( DrpBaseController );


  // View Definition
  var PredefinedView = ( function ( BaseView ) {
    //'use strict';

    return BaseView.extend( {
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

  } )( BaseView );

  // Element Definition
  var PredefinedElement = ( function ( BaseElement , PredefinedView , PredefinedController ) {
    //'use strict';

    return BaseElement.extend( {
      constructor: function ( opts ){
        this.base( opts );

        var viewOpts = _.extend( { target: opts.target } , opts.viewOpts );
        this.setView( new PredefinedView( viewOpts ) );

        this.setController( new PredefinedController( this ) );
      }

    } );

  } )( BaseElement , PredefinedView , PredefinedController );










/***********************************************************************************************************************
 *
 * Calendar
 *
 **********************************************************************************************************************/


    // Controller Definition
  var CalendarController = ( function ( BaseController ){
    //'use strict';

    function generateRange ( date , min , max , start , end , grain , span , itemFormat ){
      var current   = start.clone(),
          dates = [];

      while ( current.isBefore( end ) ){
        dates.push( {
          date: current,
          label: current.format( itemFormat ),
          isSelected: current.isSame( date , grain ),
          isDisabled:
            ( min && current.isBefore( min , grain ) ) ||
            ( max && current.isAfter ( max , grain ) ) ||
            ( span && !current.isSame( date , span ) )
        } );

        current = current.clone();
        current.add( 1, grain );
      }

      return dates;
    }
      

    return BaseController.extend( {
      constructor: function ( element ){
        this.base( element );

        // Create Bindings
        this.listenTo ( element.getView() , 'selectDate' , this.selectDate );
      },
      model2viewModel: function ( state , params ){
        var start = state.getStart( params.date ),
            end = state.getEnd( params.date );
        return {
          range: generateRange( params.date , params.min , params.max , start , end , state.grain , state.span, state.itemDisplayFormat ) ,
          rowSize: state.rowSize
        };
      },
      selectDate: function ( newDate ){
        this.trigger( 'selectDate' , newDate );
      }

    } );

  } )( DrpBaseController );


  // View Definition
  var CalendarView = ( function ( BaseView , $ , _ , moment ) {
    //'use strict';

    function selfOrDescendant( target , selector ){
      return $( target ).find( selector ).addBack( selector );
    }

    function renderBody ( view , model ){
      var $body = $( view.renderTemplate( view.getTemplate( 'body' ), model ) ),
          $rows = selfOrDescendant( $body , '.rows' ),
          rowSize = model.rowSize,
          items = _.clone( model.range ),
          row;

      while( !_.isEmpty( items ) ){
        row = { items: _.first ( items , rowSize ) };
        $rows.append( renderRow( view , row  ) );
        items = _.rest( items ,  model.rowSize );
      }

      return $body;
    }

    function renderRow ( view , model ){
      var $row = $( view.renderTemplate( view.getTemplate( 'row' ) , model ) ),
          $items = selfOrDescendant( $row , '.items' );

      _.forEach( model.items , function ( item ){
        $items.append( renderItem( view , item ) );
      } );

      return $row;
    }

    function renderItem ( view , model ){
      var $item = $( view.renderTemplate( view.getTemplate( 'item' ) , model ) );

      if ( !model.isDisabled ){
        $item.click( _.partial( selectDate , view , model.date.clone() ) );
      }

      return $item;
    }

    function selectDate ( view , date ){
      view.trigger( 'selectDate' , date );
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
  var CalendarElement = ( function ( _ , moment , BaseElement , CalendarView , DayCalendarController ) {
    //'use strict';

    return BaseElement.extend( {
      constructor: function ( opts ){
        this.base( opts );

        var viewOpts = _.extend( { target: opts.target } , opts.viewOpts );
        this.setView( new CalendarView( viewOpts ) );

        this.setController( new CalendarController( this ) );
      }
    } );

  } )( _ , moment , BaseElement , CalendarView , CalendarController );






  // DRP Element
  var DayCalendarElement = ( function ( _ , moment , CalendarElement ) {
    //'use strict';
    
    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'month' )[ op ]( 'week' );
    }

    return CalendarElement.extend( {
      constructor: function ( opts ){
        var newOpts = _.clone( opts ) || {};

        newOpts.state = {
          rowSize: 7,
          getStart: _.partial( getLimit , 'start' ),
          getEnd: _.partial( getLimit , 'end' ),
          grain: 'day',
          span: 'month',
          itemDisplayFormat: 'D'
        };

        this.base( newOpts )

      }
    } );

  } )( _ , moment , CalendarElement );


 // DRP Element
  var MonthCalendarElement = ( function ( _ , moment , CalendarElement ) {
    //'use strict';
    
    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'year' );
    }

    return CalendarElement.extend( {
      constructor: function ( opts ){
        var newOpts = _.clone( opts ) || {};

        newOpts.state = {
          rowSize: 3,
          getStart: _.partial( getLimit , 'start' ),
          getEnd: _.partial( getLimit , 'end' ),
          grain: 'month',
          span: 'year',
          itemDisplayFormat: 'MMM'
        };

        this.base( newOpts )

      }
    } );

  } )( _ , moment , CalendarElement );


   // DRP Element
  var YearCalendarElement = ( function ( _ , moment , CalendarElement ) {
    //'use strict';
    
    function getStart ( ){
      return moment().add( -20 , 'year' ).startOf('year');
    }

    function getEnd ( ){
      return moment().endOf('year');
    }

    return CalendarElement.extend( {
      constructor: function ( opts ){
        var newOpts = _.clone( opts ) || {};

        newOpts.state = {
          rowSize: 3,
          // TODO: review this
          getStart: getStart ,
          getEnd: getEnd,
          grain: 'year',
          itemDisplayFormat: 'YYYY'
        };

        this.base( newOpts )

      }
    } );

  } )( _ , moment , CalendarElement );


 // DRP Element
  var WeekCalendarElement = ( function ( _ , moment , CalendarElement ) {
    //'use strict';
    
    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'year' )[op]('week');
    }

    return CalendarElement.extend( {
      constructor: function ( opts ){
        var newOpts = _.clone( opts ) || {};

        newOpts.state = {
          rowSize: 2,
          getStart: _.partial( getLimit , 'start' ),
          getEnd: _.partial( getLimit , 'end' ),
          grain: 'week',
          itemDisplayFormat: 'WW'
        };

        this.base( newOpts )

      }
    } );

  } )( _ , moment , CalendarElement );


/***********************************************************************************************************************
 *
 * Calendar Dialog
 *
 **********************************************************************************************************************/


  var CalendarDialogView = ( function ( BaseView , DayCalendarElement , MonthCalendarElement , WeekCalendarElement , YearCalendarElement ){
    // 'use strict';
    
    function getCalendarElement ( mode ){
      var map = {
        'day' : DayCalendarElement,
        'week': WeekCalendarElement,
        'month': MonthCalendarElement,
        'year': YearCalendarElement
      };
      return ( mode && map[mode] ) || map['day'];
    }
    
    return BaseView.extend({
      events:{
        'click .dayMode': 'selectDay',
        'click .weekMode': 'selectWeek',
        'click .monthMode': 'selectMonth',
        'click .yearMode': 'selectYear'
      },
      selectDay: function ( mode ){ this.selectMode('day') },
      selectWeek: function ( mode ){ this.selectMode('week') },
      selectMonth: function ( mode ){ this.selectMode('month') },
      selectYear: function ( mode ){ this.selectMode('year') },
      selectMode: function ( mode ){
        this.trigger('selectMode', mode );
      },
      template: 
        '<div>' +
        '  <div class="modesContainer">' +
        '    <div class="dayMode">Day</div>' +
        '    <div class="weekMode">Week</div>' +
        '    <div class="monthMode">Month</div>' +
        '    <div class="yearMode">Year</div>' +
        '  </div>'+
        '  <div class="calendarContainer">' +
        '  </div>' +
        '</div>',
      renderChildren: function ( target , model ){
        var myself = this;

        var CurrentCalendar = getCalendarElement( model.get('mode') ),
            calendar = new CurrentCalendar( {
              target: $(target).find('.calendarContainer') 
            });
        calendar.update({
          date: model.get('date')
        });
        myself.listenTo( calendar , 'selectDate' , function ( newDate ) {
          myself.trigger( 'selectDate' , newDate );
        });
      }
    });

  })( BaseView , DayCalendarElement , MonthCalendarElement , WeekCalendarElement , YearCalendarElement );


  var CalendarDialogController = ( function ( BaseController ){
    // 'use strict';
    
    return BaseController.extend({
      constructor: function ( element ){
        this.base(element);

        this.listenTo( element.getView() , 'selectDate' , this.selectDate );

        this.listenTo( element.getView() , 'selectMode' , element.getState().getSetter( 'mode' ) );
      },
      model2viewModel: function ( state ,  params ){
        return {
          mode: state.mode,
          date: params.date
        }
      },
      selectDate: function ( newDate ){
        this.trigger( 'selectDate' , newDate );
      }
    });

  })( BaseController );


  var CalendarDialogElement = ( function ( BaseElement , CalendarDialogView , CalendarDialogController ) {
    //'use strict';

    return BaseElement.extend( {
      constructor: function ( opts ){
        this.base( opts );

        var viewOpts = _.extend( { target: opts.target } , opts.viewOpts );
        this.setView( new CalendarDialogView( viewOpts ) );

        this.setController( new CalendarDialogController( this ) );

      }
    } );

  } )( BaseElement, CalendarDialogView , CalendarDialogController );



/***********************************************************************************************************************
 *
 * DRP
 *
 **********************************************************************************************************************/



  var DrpController = ( function ( _ , BaseController ){
    //'use strict';

    function partialRight( fn ){

    }

    //--------------------------------//

    return BaseController.extend( {
      constructor: function ( element ){
        this.base( element );

        // Create Bindings
        // Bind day start and date end params to internal temp state
        this.listenTo( element.getParams() , 'change:start', element.getState().getSetter( 'start' ) );
        this.listenTo( element.getParams() , 'change:end', element.getState().getSetter( 'end' ) );

        // TODO: temporarily copying predefined to internal state
        this.listenTo( element.getParams() , 'change:predefined' , element.getState().getSetter( 'predefined' ) );

        this.listenTo( element.getView() , 'clickOutside'   , this.toggleDropdown );
        this.listenTo( element.getView() , 'clickOnDisplay' , this.toggleDropdown );

        this.listenTo( element.getView() , 'changeRange' , this.updateRange );

        // TODO: Make this more generic to account for all the selector paremeters
        this.listenTo( element.getView() , 'cancel' , this.cancelAndClose );

        this.listenTo( element.getView() , 'apply' , this.applyAndClose );

        // TODO: Clean up predefined
        this.listenTo( element.getView() , 'select' , function( selectedItem ){
          var items = _.clone( element.getState().get( 'predefined' ) );
          _.forEach( items, function ( item ){
            item.isSelected = ( _.isEqual( item , selectedItem ) );
          } );
          element.getState().set( 'predefined', items );
        } );

      },

      updateRange: function ( newRange ){
        this.getElement().getState().set( newRange );
      },

      toggleDropdown: function ( value ){
        var el = this.getElement(),
            newValue = _.isUndefined( value ) ? !el.getState().get( 'isDropdownOpen' ) : value;
        if ( !newValue ){
          this.cancelSelection();
        }
        el.getState().set( 'isDropdownOpen' , newValue );
      },

      cancelSelection: function (){
        var el = this.getElement();
        el.getState().set( 'start' , el.getParams().get( 'start' ) );
        el.getState().set( 'end' , el.getParams().get( 'end' ) );
      },
      applySelection: function (){
        this.trigger( 'change' , {
          start: this.getElement().getState().get( 'start' ),
          end: this.getElement().getState().get( 'end' )
        } );
      },

      cancelAndClose: function (){
        this.cancelSelection();
        this.getElement().getState().set( 'isDropdownOpen' , false );
      },
      applyAndClose: function (){
        this.applySelection();
        this.getElement().getState().set( 'isDropdownOpen' , false );
      },

      model2viewModel: function ( state , params ){
        var start = state.start,
            end = state.end,
            range = ( start && start.format( 'YYYY-MM-DD' ) ) + ' To ' + ( end && end.format( 'YYYY-MM-DD' ) );

        return {
          range: range,
          start: start,
          end:   end,
          predefined: state.predefined ,
          isDropdownOpen: state.isDropdownOpen
        };
      }

    } );

  } )( _ , DrpBaseController );




  // View Definition
  var DrpView = ( function ( BaseView , $ , _ , PredefinedElement , DayCalendarElement , MonthCalendarElement , YearCalendarElement , WeekCalendarElement , CalendarDialogElement ) {
    //'use strict';

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
        'click .rangeDisplay': 'clickOnDisplay',
        'click .applyButton': 'apply',
        'click .cancelButton': 'cancel'
      },
      template:
        '<div class="drpContainer">' +
        '  <div class="rangeDisplay">' +
        '    <span> {{ range }} </span> ' +
        '  </div> ' +
        '  <div class="dropdown {{^isDropdownOpen}}hidden{{/isDropdownOpen}}"> ' +
        '    <div class="buttonsContainer">' +
        '      <button class="applyButton">Apply</button>' +
        '      <button class="cancelButton">Cancel</button>' +
        '    </div>' +
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
        '    <div class="startMonthCalendar"></div> ' +
        '    <br> ' +
        '    <div class="startYearCalendar"></div> ' +
        '    <br> ' +
        '    <div class="startWeekCalendar"></div> ' +
        '    <br> ' +
        '    <div class="endCalendar"></div> ' +
        '    <br> ' +
        '    <div class="speedyCalendar"></div> ' +
        '    <br> ' +
        '    <div class="slowPokeCalendar"></div> ' +
        '    <br> ' +
        '    <div class="startDialog"></div> ' +
        '    <br> ' +
        '  </div> ' +
        '</div>',
      clickOnDisplay: function ( predicate ) {
        this.trigger( 'clickOnDisplay' );
      },
      apply: function (){
        this.trigger( 'apply' );
      },
      cancel: function (){
        this.trigger( 'cancel' );
      },
      clickOutside: function (){
        this.trigger( 'clickOutside' );
      },
      constructor: function () {
        this.base.apply( this, arguments );

        var clickOutside = _.bind( this.clickOutside , this, false ) ;
        // TODO: verify if there are no ghost events.
        bindToPage( this.el , clickOutside );

      },
      renderChildren: function ( target , model ) {
        var $items = $( target ).find( '.selectionItems' ),
            myself = this;

        _.forEach( model.get( 'predefined' ) , function ( config , idx ) {

          var item = new PredefinedElement( {
            target: $( $items[ idx ] )
          } );

          item.update( config );
          myself.listenTo( item , 'activate' , function ( newRange ) {
            myself.trigger( 'changeRange' , newRange );
            myself.trigger( 'select' , config );
          } );
        } );

        var startCalendar = new DayCalendarElement( {
          target: $( target ).find( '.startCalendar' )
        } );
        startCalendar.update( {
          date: model.get( 'start' )
        } );
        myself.listenTo( startCalendar , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );



        var startMonthCalendar = new MonthCalendarElement( {
          target: $( target ).find( '.startMonthCalendar' )
        } );
        startMonthCalendar.update( {
          date: model.get( 'start' )
        } );
        myself.listenTo( startMonthCalendar , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );



        var startYearCalendar = new YearCalendarElement( {
          target: $( target ).find( '.startYearCalendar' )
        } );
        startYearCalendar.update( {
          date: model.get( 'start' )
        } );
        myself.listenTo( startYearCalendar , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );



        var startWeekCalendar = new WeekCalendarElement( {
          target: $( target ).find( '.startWeekCalendar' )
        } );
        startWeekCalendar.update( {
          date: model.get( 'start' )
        } );
        myself.listenTo( startWeekCalendar , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );



        var endCalendar = new DayCalendarElement( {
          target: $( target ).find( '.endCalendar' )
        } );
        endCalendar.update( {
          date: model.get( 'end' )
        } );
        myself.listenTo( endCalendar , 'selectDate' , function ( newEnd ) {
          myself.trigger( 'changeRange' , { end: newEnd } );
          myself.trigger( 'select' , null );
        } );



        var speedyCalendar = new DayCalendarElement( {
          target: $( target ).find( '.speedyCalendar' )
        } );
        speedyCalendar.update( {
          date: ( model.get( 'end' ) ? model.get( 'end' ).clone().add( 42,'day' ) : null )
        } );
/*        myself.listenTo( endCalendar , 'selectDate' , function ( newEnd ) {
          myself.trigger( 'changeRange' , { end: newEnd } );
          myself.trigger( 'select' , null );
        } );
*/

        var slowPokeCalendar = new DayCalendarElement( {
          target: $( target ).find( '.slowPokeCalendar' )
        } );
        slowPokeCalendar.update( {
          date: ( model.get( 'start' ) ? model.get( 'start' ).clone().add( 4,'day' ) : null )
        } );


        var startCalendarDialog = new CalendarDialogElement( {
          target: $( target ).find( '.startDialog' )
        } );
        startCalendarDialog.update( {
          date: model.get( 'start' )
        } );
        myself.listenTo( startCalendarDialog , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );

      }

    } );


    return View;

  } )( BaseView , $ , _ , PredefinedElement , DayCalendarElement , MonthCalendarElement , YearCalendarElement , WeekCalendarElement , CalendarDialogElement );




  // DRP Element
  var DrpElement = ( function ( BaseElement , DrpView , DrpController ) {
    //'use strict';

    return BaseElement.extend( {
      constructor: function ( opts ){
        this.base( opts );

        var viewOpts = _.extend( { target: opts.target } , opts.viewOpts );
        this.setView( new DrpView( viewOpts ) );

        this.setController( new DrpController( this ) );

      }
    } );

  } )( BaseElement, DrpView , DrpController );













/***********************************************************************************************************************
 *
 * Sandbox
 *
 **********************************************************************************************************************/


  var drp = new DrpElement( {
    target: '#somethingSomethingDarkside'
  } );


  var items = [
    { label: 'Month to Date', getRange: function ( ){ return { start: moment().startOf( 'month' ) , end: moment() }; } },
    { label: 'Last 7 Days', getRange: function ( ){ return { start: moment().add( -7,'days' ) , end: moment() }; } },
    { label: 'Year to Date', getRange: function ( ){ return { start: moment().startOf( 'year' ), end: moment() }; } }
    ];

  drp.update( {
    'start': moment(),
    'end': moment(),
    'predefined': items
  } );

  drp.listenTo( drp , 'change' , function ( newRange ){
    drp.update( newRange );
  } );



  var exports = {
    drp: drp,
    BaseBone: BaseBone
  };


  /* ------------------------------------------ */




  /* ------------------------------------------ */

  return exports;

} )( window.Backbone , window._ , window.Mustache, window.Base, window.$ );



