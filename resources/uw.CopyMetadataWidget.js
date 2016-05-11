( function ( mw, uw, $, OO ) {

	/**
	 * Metadata copier in UploadWizard's "Details" step form.
	 *
	 * @extends OO.ui.Widget
	 * @constructor
	 * @param {Object} [config] Configuration options
	 * @cfg {mw.UploadWizardUpload} copyFrom Upload to copy the details from
	 * @cfg {mw.UploadWizardUpload[]} copyTo Uploads to copy the details to
	 */
	uw.CopyMetadataWidget = function UWCopyMetadataWidget( config ) {
		var metadataType, defaultStatus, copyMetadataMsg, checkbox, field,
			fieldset = new OO.ui.FieldsetLayout(),
			$copyMetadataWrapperDiv = $( '<div>' ),
			$copyMetadataDiv = $( '<div>' );

		uw.CopyMetadataWidget.parent.call( this );

		this.copyFrom = config.copyFrom;
		this.copyTo = config.copyTo;
		this.checkboxes = {};
		this.savedSerializedData = [];

		for ( metadataType in uw.CopyMetadataWidget.static.copyMetadataTypes ) {
			defaultStatus = uw.CopyMetadataWidget.static.copyMetadataTypes[ metadataType ];
			// mwe-upwiz-copy-title, mwe-upwiz-copy-description, mwe-upwiz-copy-date,
			// mwe-upwiz-copy-categories, mwe-upwiz-copy-location, mwe-upwiz-copy-other
			copyMetadataMsg = mw.message( 'mwe-upwiz-copy-' + metadataType ).text();

			checkbox = new OO.ui.CheckboxInputWidget( {
				selected: defaultStatus
			} );

			this.checkboxes[ metadataType ] = checkbox;

			field = new OO.ui.FieldLayout( checkbox, {
				label: copyMetadataMsg,
				align: 'inline'
			} );

			fieldset.addItems( [ field ] );
		}

		// Keep our checkboxShiftClick behaviour alive
		fieldset.$element.find( 'input[type=checkbox]' ).checkboxShiftClick();

		this.$success = $( '<span>' );
		this.copyButton = new OO.ui.ButtonWidget( {
			label: mw.message( 'mwe-upwiz-copy-metadata-button' ).text(),
			flags: [ 'constructive' ]
		} );
		this.undoButton = new OO.ui.ButtonWidget( {
			label: mw.message( 'mwe-upwiz-copy-metadata-button-undo' ).text()
		} );

		this.copyButton.connect( this, {
			click: 'onCopyClick'
		} );
		this.undoButton.connect( this, {
			click: 'onUndoClick'
		} );

		this.undoButton.toggle( false );
		$copyMetadataDiv.append(
			fieldset.$element,
			this.copyButton.$element,
			this.undoButton.$element,
			this.$success
		);

		$copyMetadataWrapperDiv
			.append(
				$( '<a>' ).text( mw.msg( 'mwe-upwiz-copy-metadata' ) )
					.addClass( 'mwe-upwiz-details-copy-metadata mw-collapsible-toggle mw-collapsible-arrow' ),
				$copyMetadataDiv.addClass( 'mw-collapsible-content' )
			)
			.makeCollapsible( { collapsed: true } );

		this.$element
			.addClass( 'mwe-upwiz-copyMetadataWidget' )
			.append( $copyMetadataWrapperDiv );
	};
	OO.inheritClass( uw.CopyMetadataWidget, OO.ui.Widget );

	/**
	 * Metadata which we can copy over to other details objects.
	 *
	 * Object with key: metadata name and value: boolean value indicating default checked status
	 *
	 * @property {Object}
	 * @static
	 */
	uw.CopyMetadataWidget.static.copyMetadataTypes = {
		title: true,
		description: true,
		date: false,
		categories: true,
		location: false,
		other: true
	};

	/**
	 * Button click event handler.
	 *
	 * @private
	 */
	uw.CopyMetadataWidget.prototype.onCopyClick = function () {
		var metadataType,
			metadataTypes = [];
		for ( metadataType in uw.CopyMetadataWidget.static.copyMetadataTypes ) {
			if ( this.checkboxes[ metadataType ].isSelected() ) {
				metadataTypes.push( metadataType );
			}
		}

		this.copyMetadata( metadataTypes );

		this.undoButton.toggle( true );
		this.$success
			.text( mw.message( 'mwe-upwiz-copied-metadata' ).text() )
			.show()
			.fadeOut( 5000, 'linear' );
	};

	/**
	 * Button click event handler.
	 *
	 * @private
	 */
	uw.CopyMetadataWidget.prototype.onUndoClick = function () {
		this.restoreMetadata();

		this.undoButton.toggle( false );
		this.$success
			.text( mw.message( 'mwe-upwiz-undid-metadata' ).text() )
			.show()
			.fadeOut( 5000, 'linear' );
	};

	/**
	 * Copy metadata from the first upload to other uploads.
	 *
	 * @param {string[]} metadataTypes Types to copy, as defined in the copyMetadataTypes property
	 */
	uw.CopyMetadataWidget.prototype.copyMetadata = function ( metadataTypes ) {
		var titleZero, matches, i,
			uploads = this.copyTo,
			sourceUpload = this.copyFrom,
			serialized = sourceUpload.details.getSerialized(),
			// Values to copy
			sourceValue = {},
			// Checks for extra behaviors
			copyingTitle = false,
			copyingOther = false;

		// Filter serialized data to only the types we want to copy
		metadataTypes.forEach( function ( type ) {
			sourceValue[ type ] = serialized[ type ];
			copyingTitle = copyingTitle || type === 'title';
			copyingOther = copyingOther || type === 'other';
		} );

		if ( copyingOther ) {
			// Campaign fields are grouped with this, hmph
			sourceValue.campaigns = serialized.campaigns;
		}

		// And apply
		for ( i = 0; i < uploads.length; i++ ) {
			if ( copyingTitle ) {
				// Add number suffix to first title if no numbering present
				titleZero = sourceValue.title.title;
				matches = titleZero.match( /(\D+)(\d{1,3})(\D*)$/ );
				if ( matches === null ) {
					titleZero = titleZero + ' 01';
				}
				// Overwrite remaining title inputs with first title + increment of rightmost
				// number in the title. Note: We ignore numbers with more than three digits, because these
				// are more likely to be years ("Wikimania 2011 Celebration") or other non-sequence
				// numbers.
				/*jshint loopfunc:true */
				sourceValue.title.title = titleZero.replace( /(\D+)(\d{1,3})(\D*)$/,
					function ( str, m1, m2, m3 ) {
						var newstr = String( +m2 + i );
						return m1 + new Array( m2.length + 1 - newstr.length )
							.join( '0' ) + newstr + m3;
					}
				);
			}

			this.savedSerializedData[ i ] = uploads[ i ].details.getSerialized();
			uploads[ i ].details.setSerialized( sourceValue );
		}
	};

	/**
	 * Restore previously saved metadata that we backed up when copying.
	 */
	uw.CopyMetadataWidget.prototype.restoreMetadata = function () {
		var i,
			uploads = this.copyTo;

		for ( i = 0; i < uploads.length; i++ ) {
			uploads[ i ].details.setSerialized( this.savedSerializedData[ i ] );
		}
	};

} )( mediaWiki, mediaWiki.uploadWizard, jQuery, OO );