<?php
/**
 * Plugin Name: Falcotec Maps Plugin
 * Description: Shortcode de mapa que detecta a localização do usuário e lista lugares próximos (Google Maps + Places). Shortcode: [falcotec_maps]
 * Version: 1.1
 * Author: Victor Santos | Falcotec
 * License: GPL-2.0+
 * Text Domain: falcotec-maps
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'FALCOTEC_MAPS_VERSION', '1.1' );
define( 'FALCOTEC_MAPS_PATH', plugin_dir_path( __FILE__ ) );
define( 'FALCOTEC_MAPS_URL',  plugin_dir_url( __FILE__ ) );

require_once FALCOTEC_MAPS_PATH . 'includes/class-falcotec-maps-settings.php';

/** Migração simples da API key de plugins anteriores, se existir */
register_activation_hook( __FILE__, function(){
    foreach (['falcotec_maps_api_key','ricoy_nearby_api_key'] as $opt){
        $val = get_option($opt, '');
        if ($val){ update_option('falcotec_maps_api_key', $val); break; }
    }
});

/** Enfileira assets quando o shortcode é usado */
function falcotec_maps_enqueue_assets() {
    wp_register_style(
        'falcotec-maps',
        FALCOTEC_MAPS_URL . 'assets/css/falcotec-maps.css',
        [],
        FALCOTEC_MAPS_VERSION
    );
    wp_enqueue_style('falcotec-maps');

    wp_register_script(
        'falcotec-maps',
        FALCOTEC_MAPS_URL . 'assets/js/falcotec-maps.js',
        [],
        FALCOTEC_MAPS_VERSION,
        true
    );

    $api_key = get_option( 'falcotec_maps_api_key', '' );

    wp_localize_script('falcotec-maps', 'FALCOTEC_MAPS_VARS', [
        'apiKey'        => $api_key,
        // Tema (mantém seu visual atual)
        'brand'         => '#EB600A',
        'brand2'        => '#EB600A',
        'text'          => '#1B2030',
        'textInv'       => '#FFFFFF',
        'surface'       => '#FFFFFF',
        'surface2'      => '#F0F3FA',
        'muted'         => '#51607A',
        // Fallback (SJC)
        'defaultCenter' => [ 'lat' => -23.2237, 'lng' => -45.9009 ],
        'strings'       => [
            'radius'        => 'Raio',
            'useMyLocation' => 'Usar minha localização',
            'notFound'      => 'Nenhum local encontrado nesse raio. Tente ampliar o raio.',
            'openNow'       => 'Aberto agora',
            'closedNow'     => 'Fechado agora',
            'youAreHere'    => 'Você está aqui',
            'openMaps'      => 'Abrir no Maps',
            'route'         => 'Traçar rota',
            'geoDenied'     => 'Geolocalização indisponível. Autorize no navegador.',
            'geoFail'       => 'Não foi possível obter sua localização.',
        ],
    ]);

    wp_enqueue_script('falcotec-maps');
}

/**
 * Shortcode: [falcotec_maps title="Lojas perto de você" type="supermarket" keyword="" radius="5000"]
 *
 *  - title   : Título exibido no topo
 *  - type    : Tipo Google Places (ex.: supermarket, store, restaurant, hospital...)
 *  - keyword : Palavra/termo para refinar a busca (opcional)
 *  - radius  : Raio em metros (3000, 5000, 10000, 20000)
 */
function falcotec_maps_shortcode( $atts = [] ) {
    $atts = shortcode_atts([
        'title'   => 'Lojas perto de você',
        'type'    => 'supermarket',
        'keyword' => '',
        'radius'  => '5000',
    ], $atts, 'falcotec_maps' );

    falcotec_maps_enqueue_assets();

    $uid = uniqid('fmp_', false);

    ob_start(); ?>
    <section class="fmp-wrapper" data-falcotec data-uid="<?php echo esc_attr($uid); ?>">
      <div class="fmp-header">
        <h2><?php echo esc_html( $atts['title'] ); ?></h2>
        <div class="fmp-controls">
          <label class="fmp-field">
            <span><?php echo esc_html( 'Raio' ); ?></span>
            <select id="<?php echo esc_attr($uid); ?>_radius" class="fmp-radius" aria-label="Selecionar raio de busca">
              <option value="3000" <?php selected( $atts['radius'], '3000' ); ?>>3 km</option>
              <option value="5000" <?php selected( $atts['radius'], '5000' ); ?>>5 km</option>
              <option value="10000" <?php selected( $atts['radius'], '10000' ); ?>>10 km</option>
              <option value="20000" <?php selected( $atts['radius'], '20000' ); ?>>20 km</option>
            </select>
          </label>
          <button id="<?php echo esc_attr($uid); ?>_refresh" class="fmp-btn" aria-label="Atualizar pela minha localização">
            <?php echo esc_html( 'Usar minha localização' ); ?>
          </button>
        </div>
      </div>

      <div id="<?php echo esc_attr($uid); ?>_map" class="fmp-map" role="region" aria-label="Mapa de locais próximos"></div>

      <div id="<?php echo esc_attr($uid); ?>_results" class="fmp-grid" aria-live="polite">
        <div class="fmp-card skeleton"></div>
        <div class="fmp-card skeleton"></div>
        <div class="fmp-card skeleton"></div>
      </div>

      <div id="<?php echo esc_attr($uid); ?>_toast" class="fmp-toast" role="status" aria-live="polite"></div>

      <script>
        window.FalcotecMapsBoot = window.FalcotecMapsBoot || [];
        window.FalcotecMapsBoot.push({
          uid: "<?php echo esc_js($uid); ?>",
          initialRadius: parseInt("<?php echo esc_js($atts['radius']); ?>", 10),
          type: "<?php echo esc_js($atts['type']); ?>",
          keyword: "<?php echo esc_js($atts['keyword']); ?>"
        });
      </script>
    </section>
    <?php
    return ob_get_clean();
}
add_shortcode( 'falcotec_maps', 'falcotec_maps_shortcode' );

// Página de configurações
add_action( 'plugins_loaded', function(){
    new Falcotec_Maps_Settings();
});
