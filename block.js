( ( wp ) => {
const { registerBlockType } = wp.blocks;
const { createElement: el, Fragment, useLayoutEffect, useEffect, useRef, useState } = wp.element;
const { useBlockProps, getSpacingPresetCssVar } = wp.blockEditor;
const { useMergeRefs, useRefEffect } = wp.compose;

const BLOCK_NS = 's8/';
const NAME = 'demo-masonry';
// “import” from the block json which has been assigned to the “namespace”.
const {
	title,
	icon,
	description,
	attributes: declaredAttributes,
	supports
} = window[BLOCK_NS][NAME];

// `my` is just an import helper that prepends the plugin url on the passed string.
const { my } = window[BLOCK_NS];

const PEXELS_KEY = window[BLOCK_NS]['pexelsKey'];

const mapAspects = {
	'0.76': 'narrow',
	'1.0':  'square',
	'1.32': 'wide'
};
const [narrow, square, wide] = Object.keys( mapAspects ).map( parseFloat );
const getAspectClass = ratio => {
	let clamped = Math.min( wide, Math.max( ratio, narrow ) );
	clamped = clamped === ratio ? square.toPrecision( 2 ) : `${ clamped }`;
	// console.log(mapAspects[ clamped ], ' - ', {ratio, clamped})
	return mapAspects[ clamped ];
};

let isMasonryDefinedInIframe = false;

let Inspector;
// Dynamically imports the block inspector controls. This is done more for the
// sake of toying with module scripts in WP than anything else. It could offer
// some actual value in sparing resources when the block isn’t used were this
// import put inside the block edit function but not much – it’s not big file.
// Doing this also depends on the enqueued order of the scripts and that order
// would get upset if this editor script were referenced in block.json and
// enqueued in the regular manner.
import( my( 'inspector.js' ) ).then( (module) => {
	({ Inspector } = module)
} );

registerBlockType( BLOCK_NS + NAME, {
	title,
	icon,
	description,
	attributes: declaredAttributes,
	supports,

	edit: ( { attributes, clientId, setAttributes }) => {
		// To use Masonry without jQuery when the editor canvas is in the iframe, the block
		// has to use Masonry from within the iframe but the block has to wait for it to be
		// available and this state ensures the block rerenders then.
		const [ isMasonryDefined, setIsMasonryDefined ] = useState( isMasonryDefinedInIframe );

		const [ images, setImages ] = useState();
		const mountedRef = useRef( false );

		// Populates images from Pexels if a API key is available and otherwise some dummy images.
		useEffect( () => {
			// Avoid running twice in when StrictMode is active mostly to avoid making an
			// extraneous request to the Pexels API.
			if ( mountedRef.current ) return;
			mountedRef.current = true;

			if ( !PEXELS_KEY ) {
				setImages( Array.from({ length: 13 }, (v, i) => {
					const width = [300, 450, 600][ Math.floor( Math.random() * 3 ) ];
					const height = [300, 450, 600][ Math.floor( Math.random() * 3 ) ];
					return {
						src: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
						style: {
							background: ['mistyrose', 'papayawhip', 'antiquewhite', 'gainsboro', 'cornsilk' ][ Math.floor( Math.random() * 5 ) ],
							aspectRatio: `${width} / ${height}`,
						},
						aspectRatio: width / height
					}
				}))
			} else {
				const client = window.pexels.createClient( PEXELS_KEY );
				const query = ['buns', 'lemon', 'curves'][ Math.floor( Math.random() * 3 ) ];
				const page = Math.ceil(Math.random() * 9);
				// console.log({query, page})
				client.photos
					.search({ query, page, per_page: 13 })
					.then(({ photos }) => setImages(
						photos.map( ( { src: { large }, width, height } ) => ( {
							src: large,
							aspectRatio: width / height
						} ) ) )
					);
			}
		}, [] );

		// Tracks the ready state of the document to hold off on creating
		// Masonry until the document is complete.
		const [ isCanvasReady, setIsCanvasReady ] = useState( false );
		const refCanvasReady = useRefEffect( ( node ) => {
			const { ownerDocument: canvasDoc } = node;
			if ( canvasDoc === document || canvasDoc.readyState === 'complete' ) {
				setIsCanvasReady( true );
				return;
			}
			canvasDoc.addEventListener( 'DOMContentLoaded', () => {
				setIsCanvasReady( true );
			} );
		}, [] );

		// Keeps a reference to the Masonry instance for sharing accross effect hooks.
		const refMasonry = useRef();

		// Tracks the size of the block to (re)layout Masonry.
		const refResize = useRefEffect( ( node ) => {
			const sizer = new ResizeObserver(
				( [ { contentBoxSize: [ { inlineSize } ] } ] ) => {
					const masonry = refMasonry.current;
					if ( masonry ) {
						masonry.element.style.setProperty(
							'--content-width',
							`${ inlineSize }px`
						);
						masonry.layout();
					}
				}
			);
			sizer.observe( node, { box: 'content-box' } );
			return () => sizer.disconnect();
		}, [] );

		// When gap values change the masonry layout has to keep up.
		useLayoutEffect( () => {
			const masonry = refMasonry.current;
			if ( masonry ) masonry.layout();
		}, [ attributes.gap.values, attributes.gap.usePadding ] );

		// Pass no dependencies to ensure that each rerender the check for Masonry runs -
		// that is, until this stops being assigned to the block ref after Masonry is defined.  
		const refEffectUntilMasonry = useRefEffect(
			( element ) => {
				setIsMasonryDefined( !! element.ownerDocument.defaultView?.Masonry );
				// Let’s another block initialize with the same state.
				isMasonryDefinedInIframe = true;
			}
		);

		// Creates and destroys the Masonry instance as warranted.
		const refEffectMasonry = useRefEffect( ( element ) => {
			const { ownerDocument: { defaultView: { Masonry } } } = element;
			imagesLoaded(element, () => {
				refMasonry.current = new Masonry( element, {
					itemSelector: 'img',
					columnWidth: '.grid-sizer',
					percentPosition: true,
					gutter: '.column-gap-sizer',
					resize: false, // leave it to the resize observer.
				} );
			});

			return () => refMasonry.current?.destroy();
		}, [ images, isCanvasReady ] );

		const blockProps = useBlockProps( {
			ref: useMergeRefs( [
				refCanvasReady,
				// Until Masonry is defined attach the effect that checks for it.
				! isMasonryDefined ? refEffectUntilMasonry : null,
				// Only when Masonry is define, image data is set, and the canvas ready
				// state is complete attach the effect that creates and destroys masonry.
				isMasonryDefined && !! images && isCanvasReady ? refEffectMasonry : null,
				refResize,
			] ),
			style: getGapStyle( attributes ),
		} );

		let innards = null;
		if ( images && isCanvasReady ) {
			innards = images.map( ( { src, aspectRatio, style }, index ) => {
				return el( 'img', {
					src,
					style,
					alt: '',
					key: index,
					className: getAspectClass( aspectRatio ),
				} )
			} );
			innards.push( el( 'div', { className: 'grid-sizer', key: 'grid-sizer' } ) );
			innards.push( el( 'div', { className: 'column-gap-sizer', key: 'column-gap-sizer' } ) );
		}

		return el(Fragment, null,
			el( Inspector, {
				attributes,
				clientId,
				setAttributes,
				declaredAttributes,
			} ),
			el('div', blockProps, innards || 'fetchin’ fotos…' ),
		);
	},
	save: () => null
} );

const getGapStyle = ( { gap, style = {} } ) => {
	const gapValues = gap.usePadding
		? [ style.spacing?.padding.top, style.spacing?.padding.left ]
		: gap.values;
	const [ row, column ] = gapValues.map(
		v => v === '0' ? '0px' : getSpacingPresetCssVar( v )
	);
	return { '--row-gap': row, '--column-gap': column }
}

} )( window.wp );