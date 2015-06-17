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
      constructor: function ( component ){

        this.setComponent( component );

        // Create Bindings
        this.listenTo( component.getState()  , 'change' , this.renderView  );
        this.listenTo( component.getParams() , 'change' , this.renderView  );

      },
      setComponent: function ( component ){
        this.component = component;
      },
      getComponent: function ( ){
        return this.component;
      },
      model2viewModel: function ( state , params ){
        // Default Implementation of model -> viewModel transformation. Override as needed.
        return {
          state: state,
          params: params
        };
      },

      renderView: function (  ){
        var comp = this.getComponent(),
            state = comp.getState().toJSON(),
            params = comp.getParams().toJSON(),
            vm = this.model2viewModel( state , params );
        // TODO: too intricated. refactor cycle???
        return comp.getView().render( vm  );
      }


    } );

  } )( _ , BaseBone );



  // Base View
  var BaseView = ( function ( _ , $ , Mustache , BaseBone , Backbone , BaseModel ) {
    //'use strict';

    return BaseBone.basebonify( Backbone.View ,{
      constructor: function ( config ) {
        this.base.apply( this, arguments );
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

      setCachedContents: function ( contents ){
        this.cachedContents = contents;       
      },
      getCachedContents: function (){
        return this.cachedContents;
      },

      render: function ( model ) {
        if ( _.isObject( model ) ) { 
          this.getModel().set( model );
        }
        if ( this.getCachedContents() ){
          this.getCachedContents().detach();
        }
        // Using .hasChanged instead of binding a callback to synchronize.
        // TODO: Evaluate if async is better.
        if ( this.getModel().hasChanged() ){
          this.renderParent( this.getElement() , this.getModel() );
          this.renderChildren( this.getElement() , this.getModel() );
        } else {
          this.getElement().empty().append( this.getCachedContents() );
        }

        this.setCachedContents( this.getElement().contents() );

        return this.getElement();
      },

      // TODO: Should we have to pass the target?
      // Or should it be taken from this.$el, for coherence???
      renderParent: function ( target , model ) {
        return $(target).html( this.renderTemplate( this.getTemplate() , model.toJSON() ) );
      },
      renderTemplate: function ( template , data ){
        return Mustache.render( template ,  data );
      },
      renderChildren: _.identity

    } );

  } )( _ , $ , Mustache , BaseBone , Backbone , BaseModel );



  // Base Component
  var BaseComponent = ( function ( _ , BaseBone , BaseView , BaseModel  ) {
    //'use strict';

    return BaseBone.extend( {

      constructor: function ( opts ) {
        var _opts = opts || {};

        this.base( _opts );

        // Set Params model
        this.setParams( new BaseModel( _opts.params ) );

        // Set State model
        this.setState( new BaseModel( _opts.state ) );

      },

      // API
      update: function ( newInput ){
        // TODO: promisses???
        this.getParams().set( newInput );
        this.trigger( 'updated' , newInput );
        return this;
      },
      render: function (){
        // TODO: promisses???
        this.getController().renderView( );
        this.trigger( 'render' , this );
        return this;
      },
      mount: function ( node ){
        this.setMountNode( node );
        this.render();
        this.trigger( 'mount' , this );
        return this;
      },

      // private definitions
      setMountNode: function ( node ){
        if ( node ){
          this.mountNode = $(node);
          this.getView().setElement( this.mountNode );
        }
      },
      getMountNode: function ( ){
        return this.mountNode;
      },

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
 * Predefined Component
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
 * Predefined Component
 *
 **********************************************************************************************************************/

  // Controller Definition
  var PredefinedController = ( function ( BaseController ){
    //'use strict';

    return BaseController.extend( {
      constructor: function ( component ){
        this.base( component );

        // Create Bindings
        this.listenTo ( component.getView() , 'click' , this.activate );
      },
      model2viewModel: function ( state , params ){
        return {
          label: state.label
        };
      },
      activate: function (){
        this.trigger( 'activate' , this.getComponent().getParams().get( 'getRange' )() );
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

  // Component Definition
  var PredefinedComponent = ( function ( BaseComponent , PredefinedView , PredefinedController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};

        this.base( _opts );

        this.setView( new PredefinedView( _opts.viewOpts ) );
        this.setController( new PredefinedController( this ) );
      }

    } );

  } )( BaseComponent , PredefinedView , PredefinedController );










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
      constructor: function ( component ){
        this.base( component );

        // Create Bindings
        this.listenTo ( component.getView() , 'selectDate' , this.selectDate );
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
        return $(target).append( renderBody( this , model.toJSON() ) );
      }

    } );


    return View;

  } )( BaseView , $ , _ , moment );



  // DRP Component
  var CalendarComponent = ( function ( _ , moment , BaseComponent , CalendarView , DayCalendarController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};
        this.base( _opts );

        this.setView( new CalendarView( _opts.viewOpts ) );
        this.setController( new CalendarController( this ) );
      }
    } );

  } )( _ , moment , BaseComponent , CalendarView , CalendarController );






  // DRP Component
  var DayCalendarComponent = ( function ( _ , moment , CalendarComponent ) {
    //'use strict';
    
    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'month' )[ op ]( 'week' );
    }

    return CalendarComponent.extend( {
      constructor: function ( opts ){
        var _opts = _.clone( opts ) || {};

        _opts.state = {
          rowSize: 7,
          getStart: _.partial( getLimit , 'start' ),
          getEnd: _.partial( getLimit , 'end' ),
          grain: 'day',
          span: 'month',
          itemDisplayFormat: 'D'
        };

        this.base( _opts )

      }
    } );

  } )( _ , moment , CalendarComponent );


 // DRP Component
  var MonthCalendarComponent = ( function ( _ , moment , CalendarComponent ) {
    //'use strict';
    
    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'year' );
    }

    return CalendarComponent.extend( {
      constructor: function ( opts ){
        var _opts = _.clone( opts ) || {};

        _opts.state = {
          rowSize: 3,
          getStart: _.partial( getLimit , 'start' ),
          getEnd: _.partial( getLimit , 'end' ),
          grain: 'month',
          span: 'year',
          itemDisplayFormat: 'MMM'
        };

        this.base( _opts )

      }
    } );

  } )( _ , moment , CalendarComponent );


   // DRP Component
  var YearCalendarComponent = ( function ( _ , moment , CalendarComponent ) {
    //'use strict';
    
    function getStart ( ){
      return moment().add( -20 , 'year' ).startOf('year');
    }

    function getEnd ( ){
      return moment().endOf('year');
    }

    return CalendarComponent.extend( {
      constructor: function ( opts ){
        var _opts = _.clone( opts ) || {};

        _opts.state = {
          rowSize: 3,
          // TODO: review this
          getStart: getStart ,
          getEnd: getEnd,
          grain: 'year',
          itemDisplayFormat: 'YYYY'
        };

        this.base( _opts )

      }
    } );

  } )( _ , moment , CalendarComponent );


 // DRP Component
  var WeekCalendarComponent = ( function ( _ , moment , CalendarComponent ) {
    //'use strict';
    
    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'year' )[op]('week');
    }

    return CalendarComponent.extend( {
      constructor: function ( opts ){
        var _opts = _.clone( opts ) || {};

        _opts.state = {
          rowSize: 2,
          getStart: _.partial( getLimit , 'start' ),
          getEnd: _.partial( getLimit , 'end' ),
          grain: 'week',
          itemDisplayFormat: 'WW'
        };

        this.base( _opts )

      }
    } );

  } )( _ , moment , CalendarComponent );


/***********************************************************************************************************************
 *
 * Calendar Dialog
 *
 **********************************************************************************************************************/


  var CalendarDialogView = ( function ( BaseView , DayCalendarComponent , MonthCalendarComponent , WeekCalendarComponent , YearCalendarComponent ){
    // 'use strict';
    
    function getCalendarComponent ( mode ){
      var map = {
        'day' : DayCalendarComponent,
        'week': WeekCalendarComponent,
        'month': MonthCalendarComponent,
        'year': YearCalendarComponent
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

        var CurrentCalendar = getCalendarComponent( model.get('mode') ),
            calendar = new CurrentCalendar();
        
        calendar
          .mount( $(target).find('.calendarContainer') )
          .update({ date: model.get('date') });
        
        myself.listenTo( calendar , 'selectDate' , function ( newDate ) {
          myself.trigger( 'selectDate' , newDate );
        });
      }
    });

  })( BaseView , DayCalendarComponent , MonthCalendarComponent , WeekCalendarComponent , YearCalendarComponent );


  var CalendarDialogController = ( function ( BaseController ){
    // 'use strict';
    
    return BaseController.extend({
      constructor: function ( component ){
        this.base(component);

        this.listenTo( component.getView() , 'selectDate' , this.selectDate );

        this.listenTo( component.getView() , 'selectMode' , component.getState().getSetter( 'mode' ) );
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


  var CalendarDialogComponent = ( function ( BaseComponent , CalendarDialogView , CalendarDialogController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};
        this.base( _opts );

        this.setView( new CalendarDialogView( _opts.viewOpts ) );
        this.setController( new CalendarDialogController( this ) );

      }
    } );

  } )( BaseComponent, CalendarDialogView , CalendarDialogController );



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
      constructor: function ( component ){
        this.base( component );

        // Create Bindings
        // Bind day start and date end params to internal temp state
        this.listenTo( component.getParams() , 'change:start', component.getState().getSetter( 'start' ) );
        this.listenTo( component.getParams() , 'change:end', component.getState().getSetter( 'end' ) );

        // TODO: temporarily copying predefined to internal state
        this.listenTo( component.getParams() , 'change:predefined' , component.getState().getSetter( 'predefined' ) );

        this.listenTo( component.getView() , 'clickOutside'   , this.toggleDropdown );
        this.listenTo( component.getView() , 'clickOnDisplay' , this.toggleDropdown );

        this.listenTo( component.getView() , 'changeRange' , this.updateRange );

        // TODO: Make this more generic to account for all the selector paremeters
        this.listenTo( component.getView() , 'cancel' , this.cancelAndClose );

        this.listenTo( component.getView() , 'apply' , this.applyAndClose );

        // TODO: Clean up predefined
        this.listenTo( component.getView() , 'select' , function( selectedItem ){
          var items = _.clone( component.getState().get( 'predefined' ) );
          _.forEach( items, function ( item ){
            item.isSelected = ( _.isEqual( item , selectedItem ) );
          } );
          component.getState().set( 'predefined', items );
        } );

      },

      updateRange: function ( newRange ){
        this.getComponent().getState().set( newRange );
      },

      toggleDropdown: function ( value ){
        var comp = this.getComponent(),
            newValue = _.isUndefined( value ) ? !comp.getState().get( 'isDropdownOpen' ) : value;
        if ( !newValue ){
          this.cancelSelection();
        }
        comp.getState().set( 'isDropdownOpen' , newValue );
      },

      cancelSelection: function (){
        var comp = this.getComponent();
        comp.getState().set( 'start' , comp.getParams().get( 'start' ) );
        comp.getState().set( 'end' , comp.getParams().get( 'end' ) );
      },
      applySelection: function (){
        this.trigger( 'change' , {
          start: this.getComponent().getState().get( 'start' ),
          end: this.getComponent().getState().get( 'end' )
        } );
      },

      cancelAndClose: function (){
        this.cancelSelection();
        this.getComponent().getState().set( 'isDropdownOpen' , false );
      },
      applyAndClose: function (){
        this.applySelection();
        this.getComponent().getState().set( 'isDropdownOpen' , false );
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
  var DrpView = ( function ( BaseView , $ , _ , PredefinedComponent , DayCalendarComponent , MonthCalendarComponent , YearCalendarComponent , WeekCalendarComponent , CalendarDialogComponent ) {
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
/*        '    <div class="startCalendar"></div> ' +
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
*/      '    <div class="row"> ' +
        '      <div class="startCalendarDialog col-xs-6"></div> ' +
        '       <div class="endCalendarDialog col-xs-6"></div> ' +
        '    </div>' +
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
        this.children = {};
      },
      setElement: function (){
        this.base.apply( this, arguments );
        bindToPage( this.getElement()[0] , _.bind( this.clickOutside, this, false ) );
      },
      renderChildren: function ( target , model ) {
        var myself = this;

      
      var $items = $( target ).find( '.selectionItems' ),
          myself = this;

        _.forEach( model.get( 'predefined' ) , function ( config , idx ) {

          var item = new PredefinedComponent();

          item.mount( ( $items[ idx ] ) ).update( config );
          myself.listenTo( item , 'activate' , function ( newRange ) {
            myself.trigger( 'changeRange' , newRange );
            myself.trigger( 'select' , config );
          } );
        } );
      

      /*  ( this.children['startCalendar'] = this.children['startCalendar'] || new DayCalendarComponent() )
          .mount( $( target ).find( '.startCalendar' ) )
          .update( { date: model.get( 'start' ) } );
        myself.listenTo( this.children['startCalendar'] , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );


        ( this.children['startMonthCalendar'] = this.children['startMonthCalendar'] || new MonthCalendarComponent() )
          .mount( $( target ).find( '.startMonthCalendar' ) )
          .update( { date: model.get( 'start' ) } );
        myself.listenTo( this.children['startMonthCalendar'] , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );


        ( this.children['startYearCalendar'] = this.children['startYearCalendar'] || new YearCalendarComponent() )
          .mount( $( target ).find( '.startYearCalendar' ) )
          .update( { date: model.get( 'start' ) } );
        myself.listenTo( this.children['startYearCalendar'] , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );


        ( this.children['startWeekCalendar'] = this.children['startWeekCalendar'] || new WeekCalendarComponent() )
          .mount( $( target ).find( '.startWeekCalendar' ) )
          .update( { date: model.get( 'start' ) } );
        myself.listenTo( this.children['startWeekCalendar'] , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );*/


        ( this.children['startCalendarDialog'] = this.children['startCalendarDialog'] || new CalendarDialogComponent() )
          .mount( $( target ).find( '.startCalendarDialog' ) )
          .update( { date: model.get( 'start' ) } );
        myself.listenTo( this.children['startCalendarDialog'] , 'selectDate' , function ( newStart ) {
          myself.trigger( 'changeRange' , { start: newStart } );
          myself.trigger( 'select' , null );
        } );

        ( this.children['endCalendarDialog'] = this.children['endCalendarDialog'] || new CalendarDialogComponent() )
          .mount( $( target ).find( '.endCalendarDialog' ) )
          .update( { date: model.get( 'end' ) } );
        myself.listenTo( this.children['endCalendarDialog'] , 'selectDate' , function ( newEnd ) {
          myself.trigger( 'changeRange' , { end: newEnd } );
          myself.trigger( 'select' , null );
        } );


/*
        var endCalendar = new DayCalendarComponent( {
          target: $( target ).find( '.endCalendar' )
        } );
        endCalendar.update( {
          date: model.get( 'end' )
        } );
        myself.listenTo( endCalendar , 'selectDate' , function ( newEnd ) {
          myself.trigger( 'changeRange' , { end: newEnd } );
          myself.trigger( 'select' , null );
        } );



        var speedyCalendar = new DayCalendarComponent( {
          target: $( target ).find( '.speedyCalendar' )
        } );
        speedyCalendar.update( {
          date: ( model.get( 'end' ) ? model.get( 'end' ).clone().add( 42,'day' ) : null )
        } );
       myself.listenTo( endCalendar , 'selectDate' , function ( newEnd ) {
          myself.trigger( 'changeRange' , { end: newEnd } );
          myself.trigger( 'select' , null );
        } );


        var slowPokeCalendar = new DayCalendarComponent( {
          target: $( target ).find( '.slowPokeCalendar' )
        } );
        slowPokeCalendar.update( {
          date: ( model.get( 'start' ) ? model.get( 'start' ).clone().add( 4,'day' ) : null )
        } );
*/

      }

    } );


    return View;

  } )( BaseView , $ , _ , PredefinedComponent , DayCalendarComponent , MonthCalendarComponent , YearCalendarComponent , WeekCalendarComponent , CalendarDialogComponent );




  // DRP Component
  var DrpComponent = ( function ( BaseComponent , DrpView , DrpController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};
        this.base( _opts );

        this.setView( new DrpView( _opts.viewOpts ) );
        this.setController( new DrpController( this ) );

      }
    } );

  } )( BaseComponent, DrpView , DrpController );













/***********************************************************************************************************************
 *
 * Sandbox
 *
 **********************************************************************************************************************/


  var drp = new DrpComponent();

  drp.mount( '#somethingSomethingDarkside' );

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



/*
  var calendar = new DayCalendarComponent();

  calendar.mount('#somethingElse');

  calendar.listenTo( calendar , 'selectDate' , function ( newDate ){
    calendar.update( { date: newDate } );
  } );
*/


  var exports = {
    drp: drp,
    BaseBone: BaseBone
  };


  /* ------------------------------------------ */




  /* ------------------------------------------ */

  return exports;

} )( window.Backbone , window._ , window.Mustache, window.Base, window.$ );



