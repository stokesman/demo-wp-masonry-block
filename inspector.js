const {
	InspectorControls,
	__experimentalSpacingSizesControl: SpacingSizesControl,
} = wp.blockEditor;
const {
	Disabled,
	__experimentalSpacer: Spacer,
	ToggleControl,
	__experimentalToolsPanelItem: ToolsPanelItem,
} = wp.components;
const { createElement: el } = wp.element;

const gapLabel = 'Gap';
const gapSides = [ 'vertical', 'horizontal' ];

export const Inspector = ( { clientId, attributes, setAttributes, declaredAttributes } ) => {
	const { usePadding } = attributes.gap;
	const { top: paddingTop, left: paddingLeft } = attributes.style?.spacing?.padding ?? {};
	const [ vertical, horizontal ] = usePadding
		? [ paddingTop, paddingLeft ]
		: attributes.gap.values;
	const resetGap = () => setAttributes( { gap: declaredAttributes.gap.default });
	return el(
		InspectorControls,
		{ group: 'dimensions' },
		// Adding this tool panel is curious in theme’s that don’t support dimensions.
		// Perhaps one would want it to honor that but this is just a POC.
		el(
			ToolsPanelItem,
			{
				className: 's8-demo-wp-masonry-block/gap-control',
				label: gapLabel,
				panelId: clientId,
				isShownByDefault: true,
				hasValue: () => ! usePadding && !! vertical || !! horizontal,
				onDeselect: resetGap,
				resetAllFilter: resetGap,
			},
			el( ToggleControl, {
				label: 'Use padding for gap',
				checked: usePadding,
				onChange: ( nextChecked ) => setAttributes( {
					gap: { ...attributes.gap, usePadding: nextChecked }
				} ),
			}),
			el( Spacer, { marginTop: 4 } ),
			el( Disabled, { isDisabled: usePadding },
				el( SpacingSizesControl, {
					label: gapLabel,
					sides: gapSides,
					values: { top: vertical, bottom: vertical, left: horizontal, right: horizontal },
					onChange: ( { top, left }) => {
						setAttributes({
							gap: {
								usePadding,
								values: [ top, left ]
							}
						});
					}
				} ),
				usePadding && el( 'style', {
					children: '.s8-demo-wp-masonry-block\\/gap-control fieldset{ opacity: .5 }'
				} )
			),
		)
	);
}