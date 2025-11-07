<?php
if ( ! defined( 'ABSPATH' ) ) exit;

class Falcotec_Maps_Settings {

    public function __construct() {
        add_action( 'admin_menu', [ $this, 'menu' ] );
        add_action( 'admin_init', [ $this, 'register' ] );
    }

    public function menu() {
        add_options_page(
            __( 'Falcotec Maps', 'falcotec-maps' ),
            __( 'Falcotec Maps', 'falcotec-maps' ),
            'manage_options',
            'falcotec-maps',
            [ $this, 'render_page' ]
        );
    }

    public function register() {
        register_setting( 'falcotec_maps_group', 'falcotec_maps_api_key', [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default'           => ''
        ]);

        add_settings_section(
            'falcotec_maps_section',
            __( 'Configurações', 'falcotec-maps' ),
            function(){
                echo '<p>'. esc_html__( 'Informe sua Google Maps API Key (restrinja por HTTP referrer) e habilite Maps JavaScript + Places.', 'falcotec-maps' ) .'</p>';
            },
            'falcotec-maps'
        );

        add_settings_field(
            'falcotec_maps_api_key',
            __( 'API Key', 'falcotec-maps' ),
            function(){
                $val = get_option( 'falcotec_maps_api_key', '' );
                echo '<input type="text" name="falcotec_maps_api_key" value="'. esc_attr( $val ) .'" class="regular-text" />';
            },
            'falcotec-maps',
            'falcotec_maps_section'
        );
    }

    public function render_page() { ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'Falcotec Maps', 'falcotec-maps' ); ?></h1>
            <form method="post" action="options.php">
                <?php
                    settings_fields( 'falcotec_maps_group' );
                    do_settings_sections( 'falcotec-maps' );
                    submit_button();
                ?>
            </form>
        </div>
    <?php }
}
