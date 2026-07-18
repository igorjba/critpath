// Export IW39/IW49 de exemplo (delimitado por ponto e vírgula, como o SAP costuma exportar).
// Duas ordens de parada com operações, centros de trabalho e a rede de precedências.
export const sampleIwExport = `Ordem;Operacao;Texto breve;Centro trab.;Trabalho;Cap;Predecessoras
4500012;0010;Isolar e bloquear (LOTO);MECH;6;4;
4500012;0020;Despressurizar e purgar;MECH;10;4;0010
4500012;0030;Liberar entrada (gas-free);INSP;6;3;0020
4500012;0040;Montar andaime da coluna;SCAF;16;5;0010
4500012;0050;Abrir bocas de visita;MECH;6;4;0030 0040
4500012;0060;Inspecao interna da coluna;INSP;8;3;0050
4500012;0070;Reparo de solda no casco;WELD;16;3;0060
4500012;0080;Fechar e torquear coluna;MECH;8;4;0070
4500013;0010;Setup e plano de icamento;RIG;6;1;
4500013;0020;Puxar feixe do permutador;CRANE;12;1;0010
4500013;0030;Hidrojato do feixe;MECH;12;4;0020
4500013;0040;Reinstalar feixe;CRANE;10;1;0030
4500013;0050;Teste de estanqueidade;INSP;12;3;0040
`;
