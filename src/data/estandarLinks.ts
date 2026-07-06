// Links de documento y video por estándar
// Editable desde el panel de administración

export interface EstandarLink {
  documento: string;
  video: string;
}

export const DEFAULT_LINKS: Record<string, EstandarLink> = {
  "CL-ES-GOP-SGI-03": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQDgiX679B0OT5_O7wuBMi8GAb7KmEZCoSTtsyxuhp4Fx5M?e=DJw8jm", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQA6IgWKtP7ATpaDlBRIkbZcAQyIC41EoGmpT8mbgDw1Co8?e=32eF86" },
  "CL-ES-GOP-SGI-04": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQAJAQYe5JvyS5xLp89K3DicAQ0S2ityWzHx4ZmCY33pkI0?e=MQ5zwJ", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQC7VKLo7MPJQZTrZPLJJyn1AfN_YXxfmFZD_rPK4UMKG0w?e=I2R2s8" },
  "CL-ES-GOP-SGI-05": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQDCDaQI7ZhjRKlQaYcNgRefAZF-mzFVhwC5W01EQK3_wWM?e=FicNMS", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQD1mPHMLrHPSb2GQC_7XcuIARtSjVmq_hmPcIXyof3Ih9g?e=D4MLrK" },
  "CL-ES-GOP-SGI-06": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQCbcETuRas4TYxCbQNmkqkDAeamGRf-tsbqrhYQegyGv60?e=RyMoHj", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQAy2I6TuV72SJpgxMsS4KcvAZTrLfQsreAOIrH_A1ZF8vw?e=hb8Ul7" },
  "CL-ES-GOP-SGI-07": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQD5DoCyZSwhTJgsLJXGfopiATJa4T7KT1fmyuRNI49oTuo?e=vduNH3", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBNN2l_sZkYS6YHIpbuj-adAQC934Qtr8KK8v0ym73JmWI?e=lnaQga" },
  "CL-ES-GOP-SGI-08": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQAHt1FrmDgsQqLEECUoEg3FAWA4ix9wpBwf7JT0TmMDdjw?e=W1UrJW", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQCBBaxBR9wzSYf0h48kUCaUAW3x4fzzQBDcWzC9C8D1-aY?e=Baa36q" },
  "CL-ES-GOP-SGI-09": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQBFHlfa_dUuTLmRhFHPZfKYAb4B1OBB2nEy3wObbkpWl6I?e=ch5qR5", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQDR7zmRfvlBSbnLZGe9woETAarza3znqdtKW7xPKPffKAw?e=MQvXqV" },
  "CL-ES-GOP-SGI-10": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQBqecye3m87Rrrnh2fNLPJiASxzxHbD3HXRhWMyVpCwJmE?e=HeOTed", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQDNBGy9jXUKTIWIAggDSsZaAe29sjTj4M1m6-h_V8XLi0Q?e=1jdDxP" },
  "CL-ES-GOP-SGI-11": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQDiuBeYkMiqRbPSWAJtCUZ-AfKd7otZ0ETUEUX56VqEt2k?e=GO0n8E", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBBlOP76RJ0TY7q_-DqIVa_AfGskSIXHYyFbTAogeBbwZk?e=711gz8" },
  "CL-ES-GOP-SGI-12": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQAkLu9PWL0PR4cXFtZC_ucNAQYOKmPNkOfYTs1ew7qK73c?e=wPdJ5F", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQDtc9pamJ9WSpS0HvKhA9mIAbnxsMMTN1lQeVq--73-fgw?e=FWoC0K" },
  "CL-ES-GOP-SGI-13": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQCEGQ7V9bTTSJFnKjWV2i99ARrPbBQw06tViaYHU7-2MGI?e=foORFf", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBA4OvY6n-SR43XfMYszfzlAVb6uEx2C2EStT6cYqMsqnQ?e=4ioxAV" },
  "CL-ES-GOP-SGI-14": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQCpAinxNSg4RZahjf2u_w-cAZwS5eEJ5us_lmf-LWC2sw4?e=nwTYJi", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQB0ZaCd2-ynR50ftmYPpF2PAfVDE-MEczI7L5n7d2EBV6c?e=EEeYB3" },
  "CL-ES-GOP-SGI-15": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQB2LWMov46SSZeTGHWDT8NYATGq96ay-ugdIisFmpu0_lY?e=bPAf51", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQC6cNI3C8TZQ4NbQox-Ne5QARIwyk6EqSwWJboewkvRLkc?e=UplX67" },
  "CL-ES-GOP-SGI-16": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQD52-6Oe75fQau9iAQu3h9EAeUFIkrPdF1ai_IC87TGHCM?e=dGuJoL", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBUpYSZ0oJeTZDN0KUwdbMvARnGkOOZ2GOXnVpj-Xhce_Q?e=E4I9GB" },
  "CL-ES-GOP-SGI-17": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQAtwnF8hLZ7Sa7xL9E1Yy-TAZMDblLHIyUwbp8ZhYmTY7Y?e=584Mcw", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBUpYSZ0oJeTZDN0KUwdbMvARnGkOOZ2GOXnVpj-Xhce_Q?e=E4I9GB" },
  "CL-ES-GOP-SGI-18": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQBx-YvGD_yhR72BXLk9E7rCAZzFXOoxHH71KQRI7jYSqnY?e=ncypNo", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBUpYSZ0oJeTZDN0KUwdbMvARnGkOOZ2GOXnVpj-Xhce_Q?e=E4I9GB" },
  "CL-ES-GOP-SGI-19": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQCOQQ8G4e9KSYf3MFWwrr7vAe7bkpo0D--DGmIvS5jmAco?e=ePgIjK", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBUpYSZ0oJeTZDN0KUwdbMvARnGkOOZ2GOXnVpj-Xhce_Q?e=E4I9GB" },
  "CL-ES-GOP-SGI-20": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQAOkGwyosXeTKr6PhxBY9R3AWEBYPRlmXaGSCuWC5-dNyc?e=Vh7R1C", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQCcXBR2L5QEQa0QWb9Alz_aARFGO96otO7w8OLtJgXuQQU?e=6BPFHC" },
  "CL-ES-GOP-SGI-22": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQBnETSBRq2hR4DpPw4QsAz2Aa41RSTRrENrpO3LxHbNoww?e=1Cqu7x", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQAAc5oQwr_tR6klrQmZ0oIqAcJywRcc77CcTd4iFLHIBPI?e=T0chSQ" },
  "CL-ES-GOP-SGI-23": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQDR5SP8iBGpR68pVEIDEmsCAdzT_X4CVWmJu05egYsCBnU?e=mlVckV", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQDo79XK1fRrS7gYj-tSc9DOAU1wDUnrA8FaBc01lsS2lU0?e=NsS6Kt" },
  "CL-ES-GOP-SGI-24": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQArBl-L_m-gSInLTg5v9AgGAdWRu59fLrjprmCf_1GK5RI?e=UJ0lD0", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQDKykdskxXWRqLt_PZ7gMdPAV9IYL8mmhtunNEw9MXUnUI?e=JBFV4m" },
  "CL-ES-GOP-SGI-25": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQBIMZFHSfRHR5aFx-Z379ymAdmrWcJeqlD8fqG63i0Y8KI?e=Ty34wE", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQCaNtAKSr20Qoom2SMb9NJ_AVcsa7JKCzlDSYEKY-hQLy4?e=IBNyVL" },
  "CL-ES-GOP-SGI-26": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQBIMZFHSfRHR5aFx-Z379ymAdmrWcJeqlD8fqG63i0Y8KI?e=FO63Jv", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBxyRnRc_9CSLeg0-cKSkydAaFIgJnkYQlROrILAXGbJio?e=o6ongw" },
  "CL-ES-GOP-SGI-27": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQDSaHAwkVrCS4tb77eg-mcBAQoP69SfbBVRT6pGKtM99gU?e=b0C0wN", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQABicqOmoPkSpFXZcWf5J1kAdNEnOt6GJik-3FLu4hDvAM?e=ELl9vC" },
  "CL-ES-GOP-SGI-28": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQDeURCSDrsrQYXd4lC7ZX0aAbxBX4v0Zw17oiAiJ9W73JU?e=HuaPHn", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBFXqWI8DVlTYmfCqT5BFjPATdPCP4MLAgyJL4Pvt7tpk4?e=ab6RVn" },
  "CL-ES-GOP-SGI-29": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQCR0Zk_knvtSrPCtDSob84CASQqFcvZRgwZ_1vYp4hOB-o?e=QZjIIk", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQAdDP8poz4UQLOwnHxXWpwVATF2ASiF0BSD7aysSsufaI4?e=H1D4O7" },
  "CL-ES-GOP-SGI-30": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQBegGt7NxmgT6laTSNhN5kdARL2-T7vXQvzpFcO3PpPiS4?e=gS2cF6", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQCvXKbE5trjSo-1FaBYEz8RAXoFaptyCOJ0vpwSPLgoOqk?e=LNkANM" },
  "CL-ES-GOP-SGI-32": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQCHmsgPBbxYRKY1WLpOxmdiAQ-_EO4t8DPAlOWO3ArtbAU?e=vJivpI", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQAaXwlJzmqeSIK0JadBJxJcAeCmhyAcfOVaSUSYbhnrZOM?e=wb8ml8" },
  "CL-ES-GOP-SGI-34": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQBPXr4dxgceSY1vshiMShY0ASkn8v2TbXbZFfiWRdoy7ls?e=Vlbm5f", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQAfa8N4UsxzSYF1ely_4kk4AdyDa-va_l4tFW378i1gr9Y?e=7J3qXo" },
  "CL-ES-GOP-SGI-35": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQDTdw6RpAQJSrqirlS8G-LaARobiPy4ED5UaPNC4R4MYAk?e=EerQQB", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQB33lKwCsfDS7Myox_nVt2qAYn-piEUG9UeJ86T4lus5LA?e=5u43vl" },
  "CL-ES-GOP-SGI-36": { documento: "https://cobraperusa.sharepoint.com/:b:/g/IQAgc59HXwwXTKYc_dFP1_8xATnCmwiPdcrE2rWPUyalCic?e=Yrinox", video: "https://cobraperusa.sharepoint.com/:v:/s/InduccionesyCapacitacionesvirtuales/IQBT0MYGEzKkSrXatSlPiZHFAaVE1k9hdE7SjgRC1ZF8uOI?e=CSKMTn" },
};

const LS_KEY = 'bisa-estandar-links';

export function getLinks(): Record<string, EstandarLink> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_LINKS, ...JSON.parse(raw) };
  } catch { /* fallback */ }
  return DEFAULT_LINKS;
}

export function getLinksByCodigo(codigo: string): EstandarLink | null {
  return getLinks()[codigo] ?? null;
}

export function saveLinks(links: Record<string, EstandarLink>): void {
  localStorage.setItem(LS_KEY, JSON.stringify(links));
}

export function resetLinks(): void {
  localStorage.removeItem(LS_KEY);
}
