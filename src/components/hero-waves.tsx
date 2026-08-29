export function HeroWaves() {
  return (
    <div className="hero-waves" aria-hidden>
      <svg
        className="hero-waves-svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <g>
          <path
            className="hero-wave-line"
            d="M -80 340 C 80 300 40 500 220 470 C 400 440 360 640 560 620 C 740 600 700 820 920 980"
          />
          <path
            className="hero-wave-line"
            d="M -110 390 C 50 350 10 550 190 520 C 370 490 330 690 530 670 C 710 650 670 870 890 1030"
          />
          <path
            className="hero-wave-line"
            d="M -140 440 C 20 400 -20 600 160 570 C 340 540 300 740 500 720 C 680 700 640 920 860 1080"
          />
        </g>
        <g>
          <path
            className="hero-wave-line reverse"
            d="M 1520 -40 C 1360 40 1420 160 1220 250 C 1020 340 1120 460 900 560 C 720 640 820 760 620 880"
          />
          <path
            className="hero-wave-line reverse"
            d="M 1555 8 C 1395 88 1455 208 1255 298 C 1055 388 1155 508 935 608 C 755 688 855 808 655 928"
          />
          <path
            className="hero-wave-line reverse"
            d="M 1590 56 C 1430 136 1490 256 1290 346 C 1090 436 1190 556 970 656 C 790 736 890 856 690 976"
          />
        </g>
      </svg>
    </div>
  );
}
