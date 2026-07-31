# App Bomba Show

Quiero hacer una app para mi charanga. La idea es trasladar el proyecto a github y luego al servidor Cloudflare Pages sincronizando estas dos. Esta app quiero utilizarla para varias cosas.

1.- Letras de las canciones, tanto de calle como de un arreglo que se toca en parado. Para esto necesito un buscador de texto rápido para localizar la letra de esa canción concreta enseguida. En este apartado (que recuerda que se divide en 2) necesito un botón de añadir letra para que en el futuro se añadan canciones nuevas. Por eso habia pensado en separarlas en 2 pestañas diferentes dentro de "Letras". En cada letra nueva, este texto necesito que pueda hacerse negrita, cursiva y subrallado. Por si necesito poner varias letras diferentes en un mismo texto.

2.- Un apartado de construcción de repertorio de concierto, en el que se añadirá el repertorio con su duración en minutos + segundos. Una vez añada todo el repertorio que tengo (que siempre se podrá modificar, eliminar o añadir nuevo), se sincronizará con toda la app para que aparezcan en el punto 1 y en el 4. Por tanto también podré añadir la letra. En este apartado en concreto, se trata de añadirlo a un Set List nuevo en el que se va sumando el tiempo de cada arreglo y aparece el tiempo total añadido al setlist. Por tanto necesito un apartado para ir creando cada arreglo con su duración y que se quede guardado. Luego, la posibilidad de crear nuevo Setlist para la construcción del repertorio para un concierto concreto.

3.- Un apartado de contadores para cada canción de barro. Esto me servirá para que en unas fiestas que se tocan varios ideas, anotar las veces que he tocado una canción para repetirla lo mínimo posible. Por tanto necesito añadir contadores con el título de la canción. Estos contadores quiero poderlos resetear todos al mismo tiempo a 0 para unas nuevas fiestas. Pero si que quiero dentro de este apartado un botón para ver las estadísticas. En estas aparecerán el total de veces que se ha tocado cada canción. Esta tabla quiero que se vea en diferentes vistas: Mes, año y de reseteo en reseteo.

4.- Lo mismo que el punto 3 pero para Arreglos. Ademas quiero añadir tags para que luego se pueda filtrar y buscar más rápido. Estos arreglos serán los mismos (sincronizados) que los que añado en el punto 2. Por esto en esta pestaña de contadores también tendré la info de duración y sus letras.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/60005ef4-fa07-4d4e-8132-531a977c1439).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
