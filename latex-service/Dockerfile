FROM texlive/texlive:latest-minimal

RUN tlmgr install \
	pdftex latex latex-bin xetex \
	amsmath amscls amsfonts geometry fancyhdr enumitem \
	graphics xcolor hyperref pgf pgfplots chemfig \
	listings booktabs multirow makecell tcolorbox \
	fontspec unicode-math exam mathtools cancel siunitx

RUN set -eux; \
	texbin="$(find /usr/local/texlive -path '*/bin/*' -name pdflatex -exec dirname {} \; | head -n 1)"; \
	test -n "$texbin"; \
	ln -sf "$texbin/pdflatex" /usr/local/bin/pdflatex; \
	ln -sf "$texbin/xelatex" /usr/local/bin/xelatex

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	poppler-utils \
	nodejs \
	npm \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY server.js ./

EXPOSE 8080
CMD ["node", "server.js"]
