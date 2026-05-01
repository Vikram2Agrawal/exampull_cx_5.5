FROM texlive/texlive:latest-minimal

RUN tlmgr install \
	amsmath amscls amsfonts geometry fancyhdr enumitem \
	graphics xcolor hyperref pgf pgfplots chemfig \
	listings booktabs multirow makecell tcolorbox \
	fontspec unicode-math exam mathtools cancel siunitx

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
