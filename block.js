( ( wp ) => {
const { registerBlockType } = wp.blocks;
const { createElement: el, Fragment, useLayoutEffect, useRef, useState } = wp.element;
const { useBlockProps, getSpacingPresetCssVar } = wp.blockEditor;
const { Placeholder, Button } = wp.components;
const { useMergeRefs, useRefEffect } = wp.compose;

const {
	metadata: { name, ...metadata },
	dir,
	pexelsKey: PEXELS_KEY,
} = window['s8-demo-masonry-editor-data'];

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
import( `${dir}inspector.js` ).then( (module) => {
	({ Inspector } = module)
} );

registerBlockType( name, {
	...metadata,

	edit: ( { attributes, clientId, setAttributes }) => {
		// To use Masonry without jQuery when the editor canvas is in the iframe, the block
		// has to use Masonry from within the iframe but the block has to wait for it to be
		// available and this state ensures the block rerenders then.
		const [ isMasonryDefined, setIsMasonryDefined ] = useState( isMasonryDefinedInIframe );

		const { images } = attributes;
		const hasImages = images?.length > 0;

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

		// Ref effect to (re)layout Masonry for image load events. This is done
		// instead of using imagesLoaded because for some reason this works better.
		const effectItemLoad = useRefEffect( ( node ) => {
			const onLoad = () => refMasonry.current?.layout();
			if ( ! node.complete ) {
				node.addEventListener( 'load', onLoad );
				return () => node.removeEventListener( 'load', onLoad );
			}
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
			refMasonry.current = new Masonry( element, {
				itemSelector: 'img',
				columnWidth: '.grid-sizer',
				percentPosition: true,
				gutter: '.column-gap-sizer',
				resize: false, // leave it to the resize observer.
			} );
			return () => refMasonry.current?.destroy();
		}, [ images, isCanvasReady ] );

		const blockProps = useBlockProps( {
			ref: useMergeRefs( [
				refCanvasReady,
				// Until Masonry is defined attach the effect that checks for it.
				! isMasonryDefined ? refEffectUntilMasonry : null,
				// Only when Masonry is define, image data is set, and the canvas ready
				// state is complete attach the effect that creates and destroys masonry.
				isMasonryDefined && hasImages && isCanvasReady ? refEffectMasonry : null,
				refResize,
			] ),
			style: getGapStyle( attributes ),
		} );

		let innards = null;
		if ( hasImages && isCanvasReady ) {
			innards = images.map( ( { src, aspectRatio, style }, index ) => {
				return el( 'img', {
					ref: effectItemLoad,
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

		const awaitingImages = images && images.length === 0;
		let placeholder;
		if ( ! innards ) {
			if ( awaitingImages )
				placeholder = el( 'p', null, 'fetchin’ fotos…' );
			else
				placeholder = el(
					Placeholder,
					{
						icon: metadata.icon,
						label: 'Masonry',
						instructions: PEXELS_KEY
							? 'Let us populate some images from Pexels'
							: 'Let us fake some images'
					},
					el(
						Button,
						{
							onClick: async () => {
								// When actually async set the images to an empty array immediately
								// to signify the images are awaited.
								if ( PEXELS_KEY ) setAttributes( { images: [] } );
								setAttributes( { images: await getImages() } );
							}
						},
						'Fetch som fotos…'
					)
				);
		}

		return el(Fragment, null,
			el( Inspector, {
				attributes,
				clientId,
				setAttributes,
				declaredAttributes: metadata.attributes,
			} ),
			el('div', blockProps, innards || placeholder ),
		);
	},
	save: () => null
} );

const tiniestGif = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const getImages = async () => {
	if ( !PEXELS_KEY ) return Array.from({ length: 21 }, (v, i) => {
		const width = [300, 450, 600][ Math.floor( Math.random() * 3 ) ];
		const height = [300, 450, 600][ Math.floor( Math.random() * 3 ) ];
		const background = ['whitesmoke', 'peachpuff', 'papayawhip', 'floralwhite', 'gainsboro', 'cornsilk' ][
			Math.floor( Math.random() * 6 )
		];
		const aspectRatio = width / height;
		return {
			src: tiniestGif,
			style: { background, aspectRatio },
			aspectRatio,
		}
	});

	const client = window.pexels.createClient( PEXELS_KEY );
	const query = ['buns', 'lemon', 'curves'][ Math.floor( Math.random() * 3 ) ];
	const page = Math.ceil(Math.random() * 9);
	const { photos } = await client.photos.search({ query, page, per_page: 21 });
	// console.log({query, page, photos})
	return photos.map( ( { avg_color, src: { large }, width, height } ) => ( {
		src: large,
		aspectRatio: width / height,
		style: { background: avg_color },
	} ) )
}

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