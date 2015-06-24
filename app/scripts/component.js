/* jshint devel:true */


// Main wrapper
window.drp = ( function (  Backbone , _ , Mustache , Base , $ ) {
  'use strict';


  // TODO: Add event deregister functions where it makes sense.

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
      return Base.extend.apply( TargetClass, _.rest( arguments ) );
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

/*
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

  } )( BaseBone );*/



/***********************************************************************************************************************
 *
 * Base Components
 *
 **********************************************************************************************************************/

  var BaseModel = ( function ( _ , BaseBone , Backbone ) {
    //'use strict';

    return BaseBone.basebonify( Backbone.Model , {
      getSetter: function ( attributeName ){
        return _.bind( this.set , this , attributeName );
      },
      getGetter: function ( attributeName ){
        return _.bind( this.get , this , attributeName );
      },
      get: function ( attributeName ){
        return _.isEmpty( attributeName ) ? this.toJSON() : this.base.apply( this, arguments );
      }

    } );

  } )( _ , BaseBone , Backbone );

  var BaseController = ( function ( _ , BaseBone ){
    //'use strict';

    return BaseBone.extend( {
      constructor: function ( models , views ){
        this.models = {};
        this.views = {};

        _.forEach( models , _.bind( this.setModel, this ) );
        _.forEach( views , _.bind( this.setView, this ));

      },

      setModel: function ( model , id ){
        this.models[id] = model;
      },
      getModel: function ( id ){
        return this.models[id];
      },
      getModelValue: function ( id , attributeName ){
        return this.getModel( id ).get( attributeName );
      },
      setModelValue: function ( id , attributeName , value ){
        return this.getModel( id ).set( attributeName , value );
      },
      watchModelValue: function ( id , attributeName , callback ){
        var eventName = _.isEmpty( attributeName )  ? 'change' : 'change:' + attributeName;
        return this.listenTo( this.getModel( id ) , eventName , callback );
      },

      setView: function ( view  , id ){
        this.views[id] = view;
      },
      getView: function ( id ){
        return this.views[id];
      },
      watchView: function ( id , event , callback ){
        return this.listenTo( this.getView( id ) , event , callback );
      }

    } );

  } )( _ , BaseBone );

  var ComponentController = ( function ( _ , BaseController ){
    //'use strict';

    return BaseController.extend( {
      constructor: function ( stateModel , paramsModel , view ){
        this.base(
          { state: stateModel , params: paramsModel },
          { main: view }
        );

        // Create Bindings
        this.watchState( '' , this.updateView  );
        this.watchParam( '' , this.updateView  );

      },

      watchView: function ( event , callback ){
        return this.base('main' , event , callback );
      },
      getParam: function ( attribute ){
        return this.getModelValue( 'params' , attribute );
      },
      watchParam: function ( attribute , callback ){
        return this.watchModelValue( 'params' , attribute , callback );
      },
      getState: function ( attribute ){
        return this.getModelValue('state' , attribute );
      },
      setState: function ( attribute , value ){
        return this.setModelValue('state' , attribute , value );
      },
      watchState: function ( attribute , callback ){
        return this.watchModelValue( 'state' , attribute , callback );
      },


      model2viewModel: function ( state , params ){
        // Default Implementation of model -> viewModel transformation. Override as needed.
        return {
          state: state,
          params: params
        };
      },

      updateView: function (  ){
        var vm = this.model2viewModel( this.getState() , this.getParam() );
        return this.getView('main').update( vm  );
      },

      listenTo: function ( observed , eventName , callback ){
        var modifiedCallback = callback;

        if ( eventName.match( /^change:.*$/ ) ){
          var boundcallback = _.bind( callback , this );

          modifiedCallback = function ( model , value , options ){
            return boundcallback( value , options );
          };
        }

        return this.base( observed , eventName , modifiedCallback );
      }


    } );

  } )( _ , BaseController );

  var BaseView = ( function ( _ , $ , Mustache , BaseBone , Backbone , BaseModel ) {
    //'use strict';

    return BaseBone.basebonify( Backbone.View ,{
      constructor: function ( config ) {
        this.children = {};
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

      update: function ( model ) {
        if ( _.isObject( model ) ) {
          this.getModel().set( model );
        }
        if ( this.getCachedContents() ){
          this.getCachedContents().detach();
        }
        // Using .hasChanged instead of binding a callback to synchronize.
        // TODO: Evaluate if async is better.
        if ( this.getModel().hasChanged() ){
          this.render();
        } else {
          this.getElement().empty().append( this.getCachedContents() );
        }

        this.setCachedContents( this.getElement().contents() );

        return this.getElement();
      },

      render: function (){
        return this.getElement().html( this.renderTemplate( this.getTemplate() , this.getModel().toJSON() ) );
      },

      renderTemplate: function ( template , data ){
        return Mustache.render( template ,  data );
      },

      hasChild: function ( key ){
        return !!this.children[key];
      },
      getChild: function ( key ){
        return this.children[key];
      },
      setChild: function ( key , child ){
        this.children[key] = child;
      }

    } );

  } )( _ , $ , Mustache , BaseBone , Backbone , BaseModel );

  var BaseComponent = ( function ( _ , BaseBone , BaseView , BaseModel  ) {
    //'use strict';

    return BaseBone.extend( {

      constructor: function ( opts ) {
        var _opts = opts || {};

        this.base( _opts );

        // Set Params model
        this.setParamsModel( new BaseModel( _opts.params ) );

        // Set State model
        this.setStateModel( new BaseModel( _opts.state ) );

      },

      // API
      update: function ( newInput ){
        // TODO: promisses???
        this.getParamsModel().set( newInput );
        this.trigger( 'updated' , newInput );
        return this;
      },
      // TODO: Review this...
      render: function (){
        // TODO: promisses???
        this.getController().updateView( );
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

      setParamsModel: function( params ){
        this.params = params;
      },
      getParamsModel: function(){
        return this.params;
      },
      setStateModel: function( state ){
        this.state = state;
      },
      getStateModel: function(){
        return this.state;
      }

    } );

  } )( _ , BaseBone , BaseView , BaseModel );





/***********************************************************************************************************************
 *
 * Predefined Component
 *
 **********************************************************************************************************************/

  var PredefinedController = ( function ( ComponentController ){
    //'use strict';

    return ComponentController.extend( {
      constructor: function ( stateModel , paramsModel , view ){
        this.base(  stateModel , paramsModel , view );

        // Create Bindings
        this.watchView( 'clickOnDisplay' , this.activate );
      },
      model2viewModel: function ( state , params ){
        return {
          label: params.label
        };
      },
      activate: function (){
        this.trigger( 'activate' , this.getParam( 'getRange' )() );
      }
    } );

  } )( ComponentController );

  var PredefinedView = ( function ( BaseView ) {
    //'use strict';

    return BaseView.extend( {
      events: {
        'click': 'clickOnDisplay'
      },

      // Emmitted Events
      clickOnDisplay: function ( ) {
        this.trigger( 'clickOnDisplay' );
      },

      template:
        '<div>' +
        '  <span>{{ label }}</span>' +
        '</div>'

    } );

  } )( BaseView );

  var PredefinedComponent = ( function ( BaseComponent , PredefinedView , PredefinedController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};

        this.base( _opts );

        this.setView( new PredefinedView( _opts['viewOpts'] ) );
        this.setController( new PredefinedController( this.getStateModel() , this.getParamsModel() , this.getView() ) );
      }

    } );

  } )( BaseComponent , PredefinedView , PredefinedController );



/***********************************************************************************************************************
 *
 * Calendar
 *
 **********************************************************************************************************************/

  var CalendarController = ( function ( ComponentController ){
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


    return ComponentController.extend( {
      constructor: function ( stateModel , paramsModel , view ){
        this.base( stateModel , paramsModel , view );

        // Create Bindings
        this.watchView ( 'selectDate' , _.bind( this.selectDate, this ) );
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

  } )( ComponentController );

  var CalendarView = ( function ( BaseView , $ , _  ) {
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

    // Emmitted Events
    function selectDate ( view , date ){
      view.trigger( 'selectDate' , date );
    }

    //--------------------------------//


    return BaseView.extend( {
      templates: {
        row:  '<tr class="calendarRow items"></tr>',
        body: '<table><thead class="calendarHeader"></thead><tbody class="rows"></tbody></table>',
        item: '<td><div style=" {{#isDisabled}}color: grey;{{/isDisabled}} {{#isSelected}} background: green;{{/isSelected}}">{{{ label }}}</div></td>'
      },
      render: function ( ){
        return this.getElement().append( renderBody( this , this.getModel().toJSON() ) );
      }

    } );

  } )( BaseView , $ , _  );

  var CalendarComponent = ( function ( _ , moment , BaseComponent , CalendarView , CalendarController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};
        this.base( _opts );

        this.setView( new CalendarView( _opts['viewOpts'] ) );
        this.setController( new CalendarController( this.getStateModel() , this.getParamsModel() , this.getView() ) );
      }
    } );

  } )( _ , moment , BaseComponent , CalendarView , CalendarController );

  var DayCalendarComponent = ( function ( _ , moment , CalendarComponent ) {
    //'use strict';

    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'month' )[ op ]( 'week' );
    }

    return CalendarComponent.extend( {
      constructor: function ( ){
         this.base.apply( this , arguments );

        this.getStateModel().set({
          rowSize: 7,
          getStart: _.partial(getLimit, 'start'),
          getEnd: _.partial(getLimit, 'end'),
          grain: 'day',
          span: 'month',
          itemDisplayFormat: 'D'
        });

      }
    } );

  } )( _ , moment , CalendarComponent );

  var MonthCalendarComponent = ( function ( _ , moment , CalendarComponent ) {
    //'use strict';

    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'year' );
    }

    return CalendarComponent.extend( {
      constructor: function ( ){
        this.base.apply( this , arguments );

        this.getStateModel().set({
          rowSize: 3,
          getStart: _.partial( getLimit , 'start' ),
          getEnd: _.partial( getLimit , 'end' ),
          grain: 'month',
          span: 'year',
          itemDisplayFormat: 'MMM'
        });

      }
    } );

  } )( _ , moment , CalendarComponent );

  var YearCalendarComponent = ( function ( _ , moment , CalendarComponent ) {
    //'use strict';

    function getStart ( ){
      return moment().add( -20 , 'year' ).startOf('year');
    }

    function getEnd ( ){
      return moment().endOf('year');
    }

    return CalendarComponent.extend( {
      constructor: function ( ){
        this.base.apply( this , arguments );

        this.getStateModel().set({
          rowSize: 3,
          // TODO: review this
          getStart: getStart ,
          getEnd: getEnd,
          grain: 'year',
          itemDisplayFormat: 'YYYY'
        });

      }
    } );

  } )( _ , moment , CalendarComponent );

  var WeekCalendarComponent = ( function ( _ , moment , CalendarComponent ) {
    //'use strict';

    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'year' )[op]('week');
    }

    return CalendarComponent.extend( {
      constructor: function ( ){
        this.base.apply( this , arguments );

        this.getStateModel().set({
          rowSize: 2,
          getStart: _.partial( getLimit , 'start' ),
          getEnd: _.partial( getLimit , 'end' ),
          grain: 'week',
          itemDisplayFormat: 'WW'
        });

      }
    } );

  } )( _ , moment , CalendarComponent );

  var QuarterCalendarComponent = ( function ( _ , moment , CalendarComponent ) {
    //'use strict';

    function getLimit ( limit , reference ){
      var op = ( limit == 'end' ) ? 'endOf' : 'startOf';
      return moment( reference ).clone()[ op ]( 'year' )[op]('quarter');
    }

    return CalendarComponent.extend( {
      constructor: function ( ){
        this.base.apply( this , arguments )

        this.getStateModel().set({
          rowSize: 2,
          getStart: _.partial( getLimit , 'start' ),
          getEnd: _.partial( getLimit , 'end' ),
          grain: 'quarter',
          itemDisplayFormat: '[Q]Q'
        });

      }
    } );

  } )( _ , moment , CalendarComponent );



/***********************************************************************************************************************
 *
 * Calendar Dialog
 *
 **********************************************************************************************************************/

  var CalendarDialogView = ( function ( BaseView , DayCalendarComponent , MonthCalendarComponent , WeekCalendarComponent , YearCalendarComponent , QuarterCalendarComponent ){
    // 'use strict';

    function getCalendarComponent ( mode ){
      var map = {
        'day' : DayCalendarComponent,
        'week': WeekCalendarComponent,
        'month': MonthCalendarComponent,
        'quarter': QuarterCalendarComponent,
        'year': YearCalendarComponent
      };
      return ( mode && map[mode] ) || map['day'];
    }

    return BaseView.extend({
      events:{
        'click .dayMode': 'selectDay',
        'click .weekMode': 'selectWeek',
        'click .monthMode': 'selectMonth',
        'click .quarterMode': 'selectQuarter',
        'click .yearMode': 'selectYear'
      },

      // Emmitted Events
      selectDay: function ( ){ this.selectMode('day') },
      selectWeek: function ( ){ this.selectMode('week') },
      selectMonth: function ( ){ this.selectMode('month') },
      selectQuarter: function ( ){ this.selectMode('quarter') },
      selectYear: function ( ){ this.selectMode('year') },
      selectMode: function ( mode ){
        this.trigger('selectMode', mode );
      },

      template:
        '<div>' +
        '  <div class="modesContainer">' +
        '    <div class="dayMode">Day</div>' +
        '    <div class="weekMode">Week</div>' +
        '    <div class="monthMode">Month</div>' +
        '    <div class="quarterMode">Quarter</div>' +
        '    <div class="yearMode">Year</div>' +
        '  </div>'+
        '  <div class="calendarContainer">' +
        '  </div>' +
        '</div>',
      render: function ( ){
        var myself = this,
            target = this.getElement(),
            model = this.getModel();

        this.base.apply( this, arguments );

        var CurrentCalendar = getCalendarComponent( model.get('mode') ),
            calendar = new CurrentCalendar();

        calendar
          .mount( $(target).find('.calendarContainer') )
          .update({
            date: model.get('date'),
            max: model.get('max'),
            min: model.get('min')
          });

        myself.listenTo( calendar , 'selectDate' , function ( newDate ) {
          myself.trigger( 'selectDate' , newDate );
        });
      }
    });

  })( BaseView , DayCalendarComponent , MonthCalendarComponent , WeekCalendarComponent , YearCalendarComponent , QuarterCalendarComponent );

  var CalendarDialogController = ( function ( ComponentController ){
    // 'use strict';

    return ComponentController.extend({
      constructor: function ( stateModel , paramsModel , view ){
        this.base( stateModel , paramsModel , view );

        this.watchView( 'selectDate' , this.selectDate );

        this.watchView( 'selectMode' , stateModel.getSetter( 'mode' ) );
      },
      model2viewModel: function ( state ,  params ){
        return {
          mode: state.mode,
          date: params.date,
          max: params.max,
          min: params.min
        }
      },
      selectDate: function ( newDate ){
        // TODO: normalize date inside the max/min parameters.
        var mode = this.getState('mode'),
            op = ( this.getParam('edge') == 'end' ) ? 'endOf' : 'startOf';
        this.trigger( 'selectDate' , newDate[op]( mode ) );
      }
    });

  })( ComponentController );

  var CalendarDialogComponent = ( function ( BaseComponent , CalendarDialogView , CalendarDialogController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};
        this.base( _opts );

        this.setView( new CalendarDialogView( _opts['viewOpts'] ) );
        this.setController( new CalendarDialogController( this.getStateModel() , this.getParamsModel() , this.getView() ) );

      }
    } );

  } )( BaseComponent, CalendarDialogView , CalendarDialogController );



/***********************************************************************************************************************
 *
 * Custom Range
 *
 **********************************************************************************************************************/

  var CustomDateView = ( function ( BaseView , CalendarDialogComponent ){
    // 'use strict';

    function bindToPage ( target , callback , uniqueId) {
      return $( document )
        .off('click.' + uniqueId )
        .on( 'click.' + uniqueId , function ( ev ) {
          var aaa = uniqueId;
          // The second part of this test accounts for when the original target is already detached
          // from the DOM, possibly because another event triggered a rerender.
          if ( ! $.contains( target , ev.target ) && $.contains( document.body , ev.target ) ){
            callback();
          }
        } );
    }

    return BaseView.extend({
      events:{
        'click .dateDisplay': 'clickOnDisplay'
      },

      // Emmitted Events
      clickOnDisplay: function ( ) {
        this.trigger( 'clickOnDisplay' );
      },
      clickOutside: function (){
        this.trigger( 'clickOutside' );
      },

      template:
      '<div>' +
      '  <div class="dateDisplay">' +
      '    {{displayDate}}' +
      '  </div>'+
      '  {{#isDialogOpen}}' +
      '    <div class="calendarDialog">' +
      '    </div>' +
      '  {{/isDialogOpen}}' +
      '</div>',

      getViewId: function (){
        return this.cid;
      },
      setElement: function (){
        this.base.apply( this, arguments );
        // TODO: Fix this. Currently not working as intended.
        // bindToPage( this.getElement()[0] , _.bind( this.clickOutside, this, false ), this.getViewId() );
      },

      render: function ( ){
        var myself = this,
            target = this.getElement(),
            model = this.getModel();

        this.base.apply( this, arguments );

        if ( this.getModel().get('isDialogOpen') ){

          if ( !this.hasChild( 'calendarDialog' ) ){
            this.setChild( 'calendarDialog' , new CalendarDialogComponent() );
            myself.listenTo( this.getChild( 'calendarDialog' ) , 'selectDate', function (newDate) {
              myself.trigger('selectDate', newDate );
              myself.trigger('select', null);
            });
          }
          this.getChild( 'calendarDialog' )
            .mount( $(target).find('.calendarDialog') )
            .update( {
              date: model.get('date'),
              max: model.get('max'),
              min: model.get('min'),
              edge: model.get('edge'),
              mode: model.get('calendarMode')
            });

        }

      }
    });

  })( BaseView , CalendarDialogComponent );

  var CustomDateController = ( function ( ComponentController ){
    // 'use strict';

    return ComponentController.extend({
      constructor: function ( stateModel , paramsModel , view ){
        this.base( stateModel , paramsModel , view );

        this.watchView( 'selectDate' , this.selectDate );

        this.watchView( 'selectMode' , stateModel.getSetter( 'calendarMode' ) );

        this.watchView( 'clickOnDisplay' , this.toggleDialog );
        this.watchView( 'clickOutside'   , _.partial( this.toggleDialog , false ) );

      },
      model2viewModel: function ( state ,  params ){
        // TODO: Add formatting here
        var displayDate = params.date ? params.date.format() : "";
        return {
          calendarMode: state.calendarMode,
          date: params.date,
          max: params.max,
          min: params.min,
          edge: params.edge,
          displayDate: displayDate,
          isDialogOpen: state.isDialogOpen
        }
      },
      selectDate: function ( newDate ){
        this.trigger( 'selectDate' , newDate );
      },
      toggleDialog: function ( value ){
        var newValue = _.isUndefined( value ) ? !this.getState( 'isDialogOpen' ) : value;
        this.setState( 'isDialogOpen' , newValue );
      }
    });

  })( ComponentController );

  var CustomDateComponent = ( function ( BaseComponent , CustomDateView , CustomDateController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};

        this.base( _opts );

        this.setView( new CustomDateView( _opts['viewOpts'] ) );
        this.setController( new CustomDateController( this.getStateModel() , this.getParamsModel() , this.getView() ) );

      }
    } );

  } )( BaseComponent, CustomDateView , CustomDateController );



  /***********************************************************************************************************************
   *
   * Custom Range Component
   *
   **********************************************************************************************************************/

  var CustomRangeController = ( function ( $ , _ , ComponentController ){
    //'use strict';

    //--------------------------------//

    return ComponentController.extend( {
      constructor: function ( stateModel , paramsModel , view ){
        this.base( stateModel , paramsModel , view );

        // Create Bindings
        this.watchView( 'changeRange' , this.updateRange );

      },

      updateRange: function ( newRange ){
        this.trigger('changeRange' , newRange );
      },

      model2viewModel: function ( state , params ){
        return {
          start: params.start,
          end:   params.end,
          mode: params.mode,
          grain: params.grain,
          isSelected: params.isSelected
        };
      }

    } );

  } )( $ , _ , ComponentController );

  var CustomRangeView = ( function ( BaseView , $ , _ , DayCalendarComponent , MonthCalendarComponent , YearCalendarComponent , WeekCalendarComponent , CalendarDialogComponent , CustomDateComponent ) {
    //'use strict';

    //--------------------------------//


    return BaseView.extend( {
      events: {
        'click .customRangeLabel' : 'clickOnDisplay'
      },

      // Emmitted Events
      clickOnDisplay: function (){
        this.trigger('clickOnDisplay');
      },

      template:
      '<div class="customRangeContainer">' +
      '  <div class="customRangeLabel">' +
      '    <span> Custom Range </span> ' +
      '  </div> ' +
      '  {{#isSelected}}' +
      '    <div class="dropdown"> ' +
      '      <div class="modesContainer"> ' +
      '      </div> ' +
      '      <div class="calendarsContainer"> ' +
      '        <div class="row"> ' +
      '          <div class="startCalendarDialog col-xs-6"></div> ' +
      '          <div class="endCalendarDialog col-xs-6"></div> ' +
      '        </div>' +
      '      </div> ' +
      '      <div class="grainularityContainer"> ' +
      '    </div> ' +
      '  {{/isSelected}}' +
      '</div>',

      render: function ( ){
        var myself = this,
          target = this.getElement(),
          model = this.getModel();

        this.base.apply( this, arguments );

        if ( model.get('isSelected') ) {

          if ( !this.hasChild( 'startCalendarDialog' ) ){
            this.setChild( 'startCalendarDialog' , new CustomDateComponent() );
            myself.listenTo( this.getChild( 'startCalendarDialog' ) , 'selectDate', function (newStart) {
              myself.trigger('changeRange', {start: newStart});
            });
          }
          this.getChild( 'startCalendarDialog' )
            .mount( $(target).find('.startCalendarDialog') )
            .update( {
              date: model.get('start'),
              max: model.get('end'),
              edge: 'start'
            });


          if ( !this.hasChild( 'endCalendarDialog' ) ){
            this.setChild( 'endCalendarDialog' , new CustomDateComponent() );
            myself.listenTo( this.getChild( 'endCalendarDialog' ) , 'selectDate', function (newEnd) {
              myself.trigger('changeRange', {end: newEnd });
            });
          }
          this.getChild( 'endCalendarDialog' )
            .mount( $(target).find('.endCalendarDialog') )
            .update( {
              date: model.get('end'),
              min: model.get('start'),
              edge: 'end'
            });

        }
      }

    } );

  } )( BaseView , $ , _ , DayCalendarComponent , MonthCalendarComponent , YearCalendarComponent , WeekCalendarComponent , CalendarDialogComponent, CustomDateComponent );

  var CustomRangeComponent = ( function ( BaseComponent , CustomRangeView , CustomRangeController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};
        this.base( _opts );

        this.setView( new CustomRangeView( _opts['viewOpts'] ) );
        this.setController( new CustomRangeController( this.getStateModel() , this.getParamsModel() , this.getView() ) );

      }
    } );

  } )( BaseComponent, CustomRangeView , CustomRangeController );





/***********************************************************************************************************************
 *
 * DRP
 *
 **********************************************************************************************************************/

  var DrpController = ( function ( $ , _ , ComponentController ){
    //'use strict';

    //--------------------------------//

    return ComponentController.extend( {
      constructor: function ( stateModel , paramsModel , view ){
        this.base( stateModel , paramsModel , view );

        // Set which attributes define the range. This could be its own object but, since Backbone change detection is
        // flat, it's easier to keep track of changes if all the attributes are at the root level
        this.setRangeAttributes( [ 'start' , 'end' , 'mode' , 'grain' ] );

        // Create Bindings

        // Bind range params to range internal state to internal temp state. This is needed for apply / cancel buttons.
        _.forEach( this.getRangeAttributes() , _.bind(function( attr ){
          this.watchParam( attr , stateModel.getSetter( attr ) );
        }, this));

        // TODO: temporarily copying predefined to internal state
        this.watchParam( 'predefined' , stateModel.getSetter( 'predefined' ) );

        this.watchView( 'clickOutside'   , _.partial( this.toggleDropdown , false ) );
        this.watchView( 'clickOnDisplay' , this.toggleDropdown );
        this.watchView( 'changeRange' , this.setRange );
        this.watchView( 'cancel' , this.cancelAndClose );
        this.watchView( 'apply' , this.applyAndClose );

        // TODO: Clean up predefined
        this.watchView( 'select' , _.bind( function( selectedItem ){
          var items = $.extend( true , [], this.getState( 'predefined' ) );
          _.forEach( items, function ( item ){
            item.isSelected = ( _.isEqual( item , selectedItem ) );
          } );
          this.setState( 'predefined', items );
        }, this ) );

      },

      setRangeAttributes: function( attributes ){
        this.rangeAttributes = attributes;
      },
      getRangeAttributes: function (){
        return this.rangeAttributes;
      },
      getRangeParams: function (){
        return _.pick( this.getParam(), this.getRangeAttributes() );
      },
      getRange: function(){
        return _.pick( this.getState(), this.getRangeAttributes() );

      },
      setRange: function ( newRange ){
        var filteredRange = _.pick( newRange , this.getRangeAttributes() );
        this.setState( filteredRange );
      },

      toggleDropdown: function ( value ){
        var newValue = _.isUndefined( value ) ? !this.getState( 'isDropdownOpen' ) : value;
        if ( !newValue ){
          this.cancelSelection();
        }
        this.setState( 'isDropdownOpen' , newValue );
      },

      cancelSelection: function (){
        this.setRange( _.clone( this.getRangeParams() ) );
      },
      applySelection: function (){
        this.trigger( 'change' , this.getRange() );
      },

      cancelAndClose: function (){
        this.cancelSelection();
        this.setState( 'isDropdownOpen' , false );
      },
      applyAndClose: function (){
        this.applySelection();
        this.setState( 'isDropdownOpen' , false );
      },

      model2viewModel: function ( state , params ){
        var start = state.start,
            end = state.end,
            rangeDisplay = ( start && start.format( 'YYYY-MM-DD' ) ) + ' To ' + ( end && end.format( 'YYYY-MM-DD' ) );

        return {
          rangeDisplay: rangeDisplay,
          start: start,
          end:   end,
          mode: state.mode,
          grain: state.grain,
          predefined: state.predefined ,
          isDropdownOpen: state.isDropdownOpen
        };
      }

    } );

  } )( $ , _ , ComponentController );

  var DrpView = ( function ( BaseView , $ , _ , PredefinedComponent , CustomRangeComponent ) {
    //'use strict';

    function bindToPage ( target , callback , uniqueId ) {
      return $( document )
        .off('click.' + uniqueId )
        .on( 'click.' + uniqueId , function ( ev ) {
          // The second part of this test accounts for when the original target is already detached
          // from the DOM, possibly because another event triggered a rerender.
          if ( ! $.contains( target , ev.target ) && $.contains( document.body , ev.target ) ){
            callback();
          }
        } );
    }

    //--------------------------------//


    return BaseView.extend( {
      events: {
        'click .rangeDisplay': 'clickOnDisplay',
        'click .applyButton': 'apply',
        'click .cancelButton': 'cancel'
      },

      // Emmitted Events
      clickOnDisplay: function ( ) {
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

      template:
        '<div class="drpContainer">' +
        '  <div class="rangeDisplay">' +
        '    <span> {{ rangeDisplay }} </span> ' +
        '  </div> ' +
        '  {{#isDropdownOpen}}' +
        '  <div class="dropdown"> ' +

       // '  <div class="dropdown {{^isDropdownOpen}}hidden{{/isDropdownOpen}}"> ' +
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
        '    <div class="customRange"></div> ' +
        '    <br> ' +
        '  </div> ' +
        '  {{/isDropdownOpen}}' +
        '</div>',

      getViewId: function (){
        return this.cid;
      },
      setElement: function (){
        this.base.apply( this, arguments );
        bindToPage( this.getElement()[0] , _.bind( this.clickOutside, this, false ) , this.getViewId() );
      },
      render: function ( ){
        var myself = this,
            target = this.getElement(),
            model = this.getModel();

        this.base.apply( this, arguments );



        if ( model.get('isDropdownOpen') ) {

          var $items = $(target).find('.selectionItems');
          _.forEach(model.get('predefined'), function (config, idx) {

            var item = new PredefinedComponent();

            item.mount(( $items[idx] )).update(config);
            myself.listenTo(item, 'activate', function (newRange) {
              myself.trigger('changeRange', newRange);
              myself.trigger('select', config);
            });
          });



          if ( !this.hasChild( 'customRange' ) ){
            this.setChild( 'customRange' , new CustomRangeComponent() );
            myself.listenTo( this.getChild( 'customRange' ) , 'changeRange', function ( newRange ) {
              myself.trigger('changeRange', newRange );
              myself.trigger('select', null);
            });
          }
          this.getChild( 'customRange' )
            .mount( $(target).find('.customRange') )
            .update( {
              mode: model.mode,
              grain: model.grain,
              start: model.get('start'),
              end:  model.get('end'),
              isSelected: true // TODO
            });

        }
      }

    } );

  } )( BaseView , $ , _ , PredefinedComponent , CustomRangeComponent );

  var DrpComponent = ( function ( BaseComponent , DrpView , DrpController ) {
    //'use strict';

    return BaseComponent.extend( {
      constructor: function ( opts ){
        var _opts = opts || {};
        this.base( _opts );

        this.setView( new DrpView( _opts['viewOpts'] ) );
        this.setController( new DrpController( this.getStateModel() , this.getParamsModel() , this.getView() ) );

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


  var exports = {
    drp: drp,
    BaseBone: BaseBone
  };


  /* ------------------------------------------ */




  /* ------------------------------------------ */

  return exports;

} )( window.Backbone , window._ , window.Mustache, window.Base, window.$ );



